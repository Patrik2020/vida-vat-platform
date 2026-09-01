import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { z } from 'zod';
import {
  aggregateHungaryVatInvoice,
  calculateHungaryVat,
  classifyHungaryVatRate,
  convertHungaryVatAmountToHuf,
  evaluateAamThreshold2026,
  evaluateActivityExemption,
  evaluateDomesticConstructionReverseCharge,
  evaluatePropertySaleExemption,
  evaluatePropertySaleReverseCharge,
  evaluatePropertyRentalExemption,
  getHungaryVatRates,
  resolvePeriodicTaxPoint
} from '@vida/rules-hu';
import { sendApiError } from './errors.js';
import { OPENAPI_DOCUMENT } from './openapi.js';

const isoDate = z.iso.date();
const signedDecimal = z.string().regex(/^-?\d+(\.\d+)?$/);
const nonNegativeDecimal = z.string().regex(/^\d+(\.\d+)?$/);
const regulatedActivityGuards = {
  permitRequired: z.boolean(),
  permitHeld: z.boolean(),
  qualificationRequired: z.boolean(),
  qualifiedPersonAvailable: z.boolean()
} as const;
const propertySaleElectionFields = {
  sellerDomesticVatRegistered: z.boolean(),
  taxableElectionScope: z.enum(['none', 'all_property_sales', 'non_residential_only']),
  taxableElectionDeclaredAndEffective: z.boolean()
} as const;
const propertySaleSchema = z.discriminatedUnion('propertyKind', [
  z.object({
    effectiveDate: isoDate,
    propertyKind: z.literal('built'),
    propertyResidential: z.boolean(),
    firstOccupancy: z.discriminatedUnion('status', [
      z.object({ status: z.literal('not_occurred') }),
      z.object({ status: z.literal('occurred'), statutoryEvidenceDate: isoDate })
    ]),
    qualifyingUseOrUnitChange: z.discriminatedUnion('status', [
      z.object({ status: z.literal('none') }),
      z.object({ status: z.literal('occurred'), statutoryEvidenceDate: isoDate })
    ]),
    ...propertySaleElectionFields
  }),
  z.object({
    effectiveDate: isoDate,
    propertyKind: z.literal('undeveloped'),
    buildingPlot: z.boolean(),
    ...propertySaleElectionFields
  })
]);
const currencyTransactionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('intra_community_acquisition'), taxLiabilityDeterminationDate: isoDate }),
  z.object({ kind: z.literal('advance_payment'), taxLiabilityDeterminationDate: isoDate }),
  z.object({ kind: z.literal('section_60'), taxLiabilityDeterminationDate: isoDate }),
  z.object({ kind: z.literal('periodic_settlement_section_58'), invoiceIssueDate: isoDate }),
  z.object({ kind: z.literal('other'), performanceDate: isoDate })
]);
const officialRateElectionFields = {
  electionDeclaredToNavBeforeUse: z.boolean(),
  electionAppliesToAllForeignCurrencyTransactions: z.boolean(),
  electionLockInObserved: z.boolean(),
  exclusiveMnbOrEcbChoiceConfirmed: z.boolean()
} as const;
const directRateFields = {
  quotedCurrencyUnits: nonNegativeDecimal,
  hufAmount: nonNegativeDecimal,
  ratePublicationDate: isoDate,
  latestValidRateConfirmed: z.boolean()
} as const;
const currencyRateSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('domestic_credit_institution_sell'), ...directRateFields,
    institutionAuthorisedForDomesticCurrencyExchange: z.boolean()
  }),
  z.object({ source: z.literal('mnb'), ...directRateFields, ...officialRateElectionFields }),
  z.object({
    source: z.literal('ecb'), hufUnitsPerEur: nonNegativeDecimal, foreignCurrencyUnitsPerEur: nonNegativeDecimal.optional(),
    ratePublicationDate: isoDate, latestValidRateConfirmed: z.boolean(), ...officialRateElectionFields
  }),
  z.object({ source: z.literal('unquoted_currency_section_80_5'), precedingQuarterEuroReferenceConfirmed: z.boolean() })
]);

export function buildServer() {
  const app = Fastify({ logger: true });

  app.register(fastifySwagger, {
    mode: 'static',
    specification: { document: OPENAPI_DOCUMENT }
  });
  app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
    staticCSP: true
  });

  app.get('/health', async () => ({ status: 'ok', service: 'vida-vat-platform', version: '0.7.0' }));
  app.get('/openapi.json', async () => OPENAPI_DOCUMENT);

  app.get('/v1/hu/vat/rates', async (request, reply) => {
    const parsed = z.object({ effectiveDate: isoDate }).safeParse(request.query);
    if (!parsed.success) return sendApiError(request, reply, 400, 'invalid_request', 'effectiveDate is required in YYYY-MM-DD format', parsed.error.issues);
    try { return getHungaryVatRates(parsed.data.effectiveDate); }
    catch (error) { return sendApiError(request, reply, 422, 'unsupported_effective_date', error instanceof Error ? error.message : 'Unsupported effective date'); }
  });

  app.post('/v1/hu/vat/classify-rate', async (request, reply) => {
    const parsed = z.object({
      effectiveDate: isoDate,
      classification: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('daily_newspaper'), customsTariffCode: z.string().min(1), issuesPerWeek: z.number().int().nonnegative() }),
        z.object({ kind: z.literal('medicine'), prescriptionRequired: z.boolean(), magistral: z.boolean(), humanUse: z.boolean() }),
        z.object({
          kind: z.literal('reduced_rate_18_product'),
          category: z.enum(['milk_or_dairy', 'flavored_milk', 'cereal_flour_starch_or_milk_preparation']),
          customsTariffCode: z.string().min(1), statutoryDescriptionConfirmed: z.boolean()
        }),
        z.object({
          kind: z.literal('domesticated_cattle_food_product'), customsTariffCode: z.string().min(1), domesticatedCattle: z.boolean(), fitForHumanConsumption: z.boolean(),
          preservation: z.enum(['fresh', 'chilled', 'frozen', 'salted_or_brined', 'dried', 'smoked', 'other'])
        }),
        z.object({ kind: z.literal('declared_rate'), rate: z.union([z.literal(0), z.literal(5), z.literal(18), z.literal(27)]), legalBasisConfirmed: z.boolean() })
      ])
    }).safeParse(request.body);
    if (!parsed.success) return sendApiError(request, reply, 400, 'invalid_request', 'Request validation failed', parsed.error.issues);
    try { return classifyHungaryVatRate(parsed.data.effectiveDate, parsed.data.classification); }
    catch (error) { return sendApiError(request, reply, 422, 'classification_failed', error instanceof Error ? error.message : 'Classification failed'); }
  });

  app.post('/v1/hu/vat/calculate', async (request, reply) => {
    const parsed = z.object({
      effectiveDate: isoDate, amount: z.string().regex(/^\d+(\.\d+)?$/), amountType: z.enum(['net', 'gross']),
      treatment: z.enum(['taxable', 'exempt', 'reverse_charge']), rate: z.union([z.literal(0), z.literal(5), z.literal(18), z.literal(27)]).optional(),
      scale: z.number().int().min(0).max(6).optional()
    }).safeParse(request.body);
    if (!parsed.success) return sendApiError(request, reply, 400, 'invalid_request', 'Request validation failed', parsed.error.issues);
    try { return calculateHungaryVat(parsed.data); }
    catch (error) { return sendApiError(request, reply, 422, 'calculation_failed', error instanceof Error ? error.message : 'Calculation failed'); }
  });

  app.post('/v1/hu/vat/currency/convert-to-huf', async (request, reply) => {
    const parsed = z.object({
      currency: z.string().regex(/^[A-Z]{3}$/), amount: nonNegativeDecimal, outputScale: z.number().int().min(0).max(6).optional(),
      transaction: currencyTransactionSchema, rate: currencyRateSchema
    }).safeParse(request.body);
    if (!parsed.success) return sendApiError(request, reply, 400, 'invalid_request', 'Request validation failed', parsed.error.issues);
    try { return convertHungaryVatAmountToHuf(parsed.data); }
    catch (error) { return sendApiError(request, reply, 422, 'currency_conversion_failed', error instanceof Error ? error.message : 'Currency conversion failed'); }
  });

  app.post('/v1/hu/vat/invoices/aggregate', async (request, reply) => {
    const parsed = z.object({
      effectiveDate: isoDate, currency: z.string().regex(/^[A-Z]{3}$/), scale: z.number().int().min(0).max(6).optional(),
      roundingPolicy: z.enum(['per_line', 'per_vat_rate_summary']),
      lines: z.array(z.object({
        lineId: z.string().min(1).max(100), netAmount: signedDecimal, treatment: z.enum(['taxable', 'exempt', 'reverse_charge']),
        rate: z.union([z.literal(0), z.literal(5), z.literal(18), z.literal(27)]).optional()
      })).min(1).max(500)
    }).safeParse(request.body);
    if (!parsed.success) return sendApiError(request, reply, 400, 'invalid_request', 'Request validation failed', parsed.error.issues);
    try { return aggregateHungaryVatInvoice(parsed.data); }
    catch (error) { return sendApiError(request, reply, 422, 'invoice_aggregation_failed', error instanceof Error ? error.message : 'Invoice aggregation failed'); }
  });

  app.post('/v1/hu/vat/tax-point/periodic', async (request, reply) => {
    const parsed = z.object({ periodEnd: isoDate, invoiceDate: isoDate, dueDate: isoDate }).safeParse(request.body);
    if (!parsed.success) return sendApiError(request, reply, 400, 'invalid_request', 'Request validation failed', parsed.error.issues);
    try { return resolvePeriodicTaxPoint(parsed.data); }
    catch (error) { return sendApiError(request, reply, 422, 'tax_point_failed', error instanceof Error ? error.message : 'Tax point resolution failed'); }
  });

  app.post('/v1/hu/vat/reverse-charge/domestic-construction', async (request, reply) => {
    const parsed = z.object({
      effectiveDate: isoDate, supplierDomesticVatRegistered: z.boolean(), recipientDomesticVatRegistered: z.boolean(),
      supplierTaxPayableStatus: z.boolean(), recipientTaxPayableStatus: z.boolean(), constructionAssemblyWork: z.boolean(),
      propertyActivity: z.enum(['create', 'expand', 'transform', 'demolish', 'change_purpose', 'other']),
      authorityPermitOrNotificationRequired: z.boolean(), requiredDeclarationProvided: z.boolean()
    }).safeParse(request.body);
    if (!parsed.success) return sendApiError(request, reply, 400, 'invalid_request', 'Request validation failed', parsed.error.issues);
    try { return evaluateDomesticConstructionReverseCharge(parsed.data); }
    catch (error) { return sendApiError(request, reply, 422, 'reverse_charge_evaluation_failed', error instanceof Error ? error.message : 'Reverse-charge evaluation failed'); }
  });

  app.post('/v1/hu/vat/reverse-charge/property-sale', async (request, reply) => {
    const parsed = z.object({
      sale: propertySaleSchema,
      recipientDomesticVatRegistered: z.boolean(),
      supplierTaxPayableStatus: z.boolean(),
      recipientTaxPayableStatus: z.boolean()
    }).safeParse(request.body);
    if (!parsed.success) return sendApiError(request, reply, 400, 'invalid_request', 'Request validation failed', parsed.error.issues);
    try { return evaluatePropertySaleReverseCharge(parsed.data); }
    catch (error) { return sendApiError(request, reply, 422, 'property_sale_reverse_charge_evaluation_failed', error instanceof Error ? error.message : 'Property-sale reverse-charge evaluation failed'); }
  });

  app.post('/v1/hu/vat/exemptions/aam/threshold', async (request, reply) => {
    const parsed = z.object({
      effectiveDate: isoDate, establishedBefore2026: z.boolean(), registrationDate: isoDate.optional(), valuesCalculatedUnderSection188: z.boolean(),
      priorYearRelevantDomesticTurnoverHuf: z.string().regex(/^\d+$/),
      currentYearExpectedRelevantDomesticTurnoverHuf: z.string().regex(/^\d+$/),
      currentYearActualRelevantDomesticTurnoverHuf: z.string().regex(/^\d+$/)
    }).safeParse(request.body);
    if (!parsed.success) return sendApiError(request, reply, 400, 'invalid_request', 'Request validation failed', parsed.error.issues);
    try { return evaluateAamThreshold2026(parsed.data); }
    catch (error) { return sendApiError(request, reply, 422, 'aam_threshold_evaluation_failed', error instanceof Error ? error.message : 'AAM threshold evaluation failed'); }
  });

  app.post('/v1/hu/vat/exemptions/activity', async (request, reply) => {
    const parsed = z.discriminatedUnion('kind', [
      z.object({ effectiveDate: isoDate, kind: z.literal('human_healthcare'), serviceIsHumanHealthcare: z.boolean(), providerActsInHealthcareCapacity: z.boolean(), ...regulatedActivityGuards }),
      z.object({ effectiveDate: isoDate, kind: z.literal('dental'), supply: z.enum(['dental_service', 'dental_prosthesis']), providerActsInDentalCapacity: z.boolean(), ...regulatedActivityGuards }),
      z.object({
        effectiveDate: isoDate, kind: z.literal('education'),
        context: z.enum(['public_education', 'vocational_training', 'higher_education', 'adult_training', 'language_training', 'recognized_language_exam', 'study_competition', 'other']),
        providerActsInTeachingCapacity: z.boolean(), ...regulatedActivityGuards
      }),
      z.object({ effectiveDate: isoDate, kind: z.literal('insurance'), service: z.enum(['insurance', 'reinsurance', 'brokerage', 'intermediation']), actingInRelevantCapacity: z.boolean() }),
      z.object({ effectiveDate: isoDate, kind: z.literal('credit'), service: z.enum(['credit_provision', 'credit_intermediation', 'creditor_management']), actingInRelevantCapacity: z.boolean() }),
      z.object({
        effectiveDate: isoDate, kind: z.literal('payment_financial'),
        service: z.enum(['current_account', 'deposit_account', 'customer_account', 'payment', 'transfer', 'cheque', 'receivable', 'financial_instrument', 'intermediation']),
        actingInRelevantCapacity: z.boolean(), debtCollection: z.boolean(), portfolioManagement: z.boolean()
      })
    ]).safeParse(request.body);
    if (!parsed.success) return sendApiError(request, reply, 400, 'invalid_request', 'Request validation failed', parsed.error.issues);
    try { return evaluateActivityExemption(parsed.data); }
    catch (error) { return sendApiError(request, reply, 422, 'activity_exemption_evaluation_failed', error instanceof Error ? error.message : 'Activity exemption evaluation failed'); }
  });

  app.post('/v1/hu/vat/exemptions/property-rental', async (request, reply) => {
    const parsed = z.object({
      effectiveDate: isoDate,
      rentalKind: z.enum(['ordinary', 'commercial_accommodation', 'vehicle_parking', 'permanently_attached_equipment', 'safe']),
      propertyResidential: z.boolean(),
      taxableElectionScope: z.enum(['none', 'all_property_rentals', 'non_residential_only']),
      taxableElectionDeclaredAndEffective: z.boolean()
    }).safeParse(request.body);
    if (!parsed.success) return sendApiError(request, reply, 400, 'invalid_request', 'Request validation failed', parsed.error.issues);
    try { return evaluatePropertyRentalExemption(parsed.data); }
    catch (error) { return sendApiError(request, reply, 422, 'property_rental_exemption_evaluation_failed', error instanceof Error ? error.message : 'Property rental exemption evaluation failed'); }
  });

  app.post('/v1/hu/vat/exemptions/property-sale', async (request, reply) => {
    const parsed = propertySaleSchema.safeParse(request.body);
    if (!parsed.success) return sendApiError(request, reply, 400, 'invalid_request', 'Request validation failed', parsed.error.issues);
    try { return evaluatePropertySaleExemption(parsed.data); }
    catch (error) { return sendApiError(request, reply, 422, 'property_sale_exemption_evaluation_failed', error instanceof Error ? error.message : 'Property-sale exemption evaluation failed'); }
  });

  return app;
}

const app = buildServer();
if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  app.listen({ port, host }).catch((error) => { app.log.error(error); process.exit(1); });
}
