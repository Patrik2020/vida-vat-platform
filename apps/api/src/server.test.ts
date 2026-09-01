import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from './server.js';

const apps: ReturnType<typeof buildServer>[] = [];
function app() { const instance = buildServer(); apps.push(instance); return instance; }
afterEach(async () => { await Promise.all(apps.splice(0).map((instance) => instance.close())); });

describe('Hungary VAT API Phase 1', () => {
  it('returns the current rate catalogue including 0%', async () => {
    const response = await app().inject({ method: 'GET', url: '/v1/hu/vat/rates?effectiveDate=2026-09-01' });
    expect(response.statusCode).toBe(200);
    expect(response.json().rulesetId).toBe('HU-VAT-2026-006');
  });

  it('publishes the OpenAPI 3.0 contract and Swagger JSON', async () => {
    const direct = await app().inject({ method: 'GET', url: '/openapi.json' });
    expect(direct.statusCode).toBe(200);
    expect(direct.json()).toMatchObject({ openapi: '3.0.3', info: { version: '0.6.0' } });

    const swagger = await app().inject({ method: 'GET', url: '/docs/json' });
    expect(swagger.statusCode).toBe(200);
    expect(swagger.json().paths).toHaveProperty('/v1/hu/vat/exemptions/aam/threshold');
    expect(swagger.json().paths).toHaveProperty('/v1/hu/vat/exemptions/activity');
    expect(swagger.json().paths).toHaveProperty('/v1/hu/vat/exemptions/property-rental');
    expect(swagger.json().paths).toHaveProperty('/v1/hu/vat/exemptions/property-sale');
    expect(swagger.json().paths).toHaveProperty('/v1/hu/vat/reverse-charge/property-sale');
  });

  it('classifies supported 18% and 5% products', async () => {
    const eighteen = await app().inject({
      method: 'POST', url: '/v1/hu/vat/classify-rate',
      payload: { effectiveDate: '2026-09-01', classification: { kind: 'reduced_rate_18_product', category: 'cereal_flour_starch_or_milk_preparation', customsTariffCode: '1904', statutoryDescriptionConfirmed: true } }
    });
    expect(eighteen.statusCode).toBe(200);
    expect(eighteen.json()).toMatchObject({ status: 'classified', rate: 18 });

    const five = await app().inject({
      method: 'POST', url: '/v1/hu/vat/classify-rate',
      payload: { effectiveDate: '2026-09-01', classification: { kind: 'domesticated_cattle_food_product', customsTariffCode: '02013000', domesticatedCattle: true, fitForHumanConsumption: true, preservation: 'fresh' } }
    });
    expect(five.statusCode).toBe(200);
    expect(five.json()).toMatchObject({ status: 'classified', rate: 5 });
  });

  it('evaluates a supported healthcare exemption', async () => {
    const response = await app().inject({
      method: 'POST', url: '/v1/hu/vat/exemptions/activity',
      payload: {
        effectiveDate: '2026-09-01', kind: 'human_healthcare', serviceIsHumanHealthcare: true, providerActsInHealthcareCapacity: true,
        permitRequired: true, permitHeld: true, qualificationRequired: true, qualifiedPersonAvailable: true
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ rulesetId: 'HU-VAT-2026-006', status: 'exempt', exemptionCode: 'HU_85_1_C_HEALTHCARE' });
  });

  it('evaluates property-rental exemption and statutory exceptions', async () => {
    const ordinary = await app().inject({
      method: 'POST', url: '/v1/hu/vat/exemptions/property-rental',
      payload: { effectiveDate: '2026-09-01', rentalKind: 'ordinary', propertyResidential: true, taxableElectionScope: 'none', taxableElectionDeclaredAndEffective: false }
    });
    expect(ordinary.statusCode).toBe(200);
    expect(ordinary.json()).toMatchObject({ status: 'exempt', treatmentCode: 'HU_86_1_L_PROPERTY_RENTAL_EXEMPT' });

    const parking = await app().inject({
      method: 'POST', url: '/v1/hu/vat/exemptions/property-rental',
      payload: { effectiveDate: '2026-09-01', rentalKind: 'vehicle_parking', propertyResidential: false, taxableElectionScope: 'none', taxableElectionDeclaredAndEffective: false }
    });
    expect(parking.statusCode).toBe(200);
    expect(parking.json()).toMatchObject({ status: 'not_exempt_under_supported_rule', legalBasis: 'Áfa tv. 86. § (2)' });
  });

  it('evaluates old, new and changed-property sale treatment', async () => {
    const oldProperty = await app().inject({
      method: 'POST', url: '/v1/hu/vat/exemptions/property-sale',
      payload: {
        effectiveDate: '2026-09-01', propertyKind: 'built', propertyResidential: true,
        firstOccupancy: { status: 'occurred', statutoryEvidenceDate: '2020-01-10' },
        qualifyingUseOrUnitChange: { status: 'none' }, sellerDomesticVatRegistered: true,
        taxableElectionScope: 'none', taxableElectionDeclaredAndEffective: false
      }
    });
    expect(oldProperty.statusCode).toBe(200);
    expect(oldProperty.json()).toMatchObject({
      rulesetId: 'HU-VAT-2026-006', status: 'exempt', treatment: 'exempt', treatmentCode: 'HU_86_1_J_OLD_BUILT_PROPERTY_EXEMPT'
    });

    const changedProperty = await app().inject({
      method: 'POST', url: '/v1/hu/vat/exemptions/property-sale',
      payload: {
        effectiveDate: '2026-09-01', propertyKind: 'built', propertyResidential: false,
        firstOccupancy: { status: 'occurred', statutoryEvidenceDate: '2020-01-10' },
        qualifyingUseOrUnitChange: { status: 'occurred', statutoryEvidenceDate: '2026-01-10' },
        sellerDomesticVatRegistered: true, taxableElectionScope: 'none', taxableElectionDeclaredAndEffective: false
      }
    });
    expect(changedProperty.statusCode).toBe(200);
    expect(changedProperty.json()).toMatchObject({
      status: 'not_exempt_under_supported_rule', treatment: 'mandatory_taxable', treatmentCode: 'HU_86_1_JC_CHANGED_PROPERTY_WITHIN_TWO_YEARS'
    });
  });

  it('returns the stable property-sale error code for impossible evidence dates', async () => {
    const response = await app().inject({
      method: 'POST', url: '/v1/hu/vat/exemptions/property-sale',
      payload: {
        effectiveDate: '2026-09-01', propertyKind: 'built', propertyResidential: true,
        firstOccupancy: { status: 'occurred', statutoryEvidenceDate: '2026-09-02' },
        qualifyingUseOrUnitChange: { status: 'none' }, sellerDomesticVatRegistered: true,
        taxableElectionScope: 'none', taxableElectionDeclaredAndEffective: false
      }
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: { code: 'property_sale_exemption_evaluation_failed', requestId: expect.any(String) } });
  });

  it('evaluates §142 property-sale reverse charge without confusing mandatory-taxable new property', async () => {
    const response = await app().inject({
      method: 'POST', url: '/v1/hu/vat/reverse-charge/property-sale',
      payload: {
        sale: {
          effectiveDate: '2026-09-01', propertyKind: 'undeveloped', buildingPlot: false,
          sellerDomesticVatRegistered: true, taxableElectionScope: 'all_property_sales', taxableElectionDeclaredAndEffective: true
        },
        recipientDomesticVatRegistered: true, supplierTaxPayableStatus: true, recipientTaxPayableStatus: true
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      rulesetId: 'HU-VAT-2026-006', status: 'reverse_charge', eligible: true,
      propertySaleTreatmentCode: 'HU_88_PROPERTY_SALE_TAXABLE_ELECTION'
    });

    const buildingPlot = await app().inject({
      method: 'POST', url: '/v1/hu/vat/reverse-charge/property-sale',
      payload: {
        sale: {
          effectiveDate: '2026-09-01', propertyKind: 'undeveloped', buildingPlot: true,
          sellerDomesticVatRegistered: true, taxableElectionScope: 'none', taxableElectionDeclaredAndEffective: false
        },
        recipientDomesticVatRegistered: true, supplierTaxPayableStatus: true, recipientTaxPayableStatus: true
      }
    });
    expect(buildingPlot.statusCode).toBe(200);
    expect(buildingPlot.json()).toMatchObject({ status: 'not_reverse_charge_under_supported_rule', eligible: false });
  });

  it('evaluates the annual 2026 AAM threshold', async () => {
    const response = await app().inject({
      method: 'POST', url: '/v1/hu/vat/exemptions/aam/threshold',
      payload: {
        effectiveDate: '2026-09-01', establishedBefore2026: true, valuesCalculatedUnderSection188: true,
        priorYearRelevantDomesticTurnoverHuf: '19000000', currentYearExpectedRelevantDomesticTurnoverHuf: '19500000', currentYearActualRelevantDomesticTurnoverHuf: '10000000'
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'eligible_within_threshold', thresholdMode: 'annual', thresholdHuf: '20000000' });
  });

  it('evaluates the section 189 time-proportional AAM threshold', async () => {
    const response = await app().inject({
      method: 'POST', url: '/v1/hu/vat/exemptions/aam/threshold',
      payload: {
        effectiveDate: '2026-09-01', establishedBefore2026: false, registrationDate: '2026-07-01', valuesCalculatedUnderSection188: true,
        priorYearRelevantDomesticTurnoverHuf: '0', currentYearExpectedRelevantDomesticTurnoverHuf: '10000000', currentYearActualRelevantDomesticTurnoverHuf: '5000000'
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      rulesetId: 'HU-VAT-2026-006', status: 'eligible_within_threshold', thresholdMode: 'time_proportional', thresholdHuf: '10082191', activeDays: 184, daysInYear: 365
    });
  });

  it('calculates 27% VAT from net with the active ruleset id', async () => {
    const response = await app().inject({
      method: 'POST', url: '/v1/hu/vat/calculate',
      payload: { effectiveDate: '2026-09-01', amount: '100.00', amountType: 'net', treatment: 'taxable', rate: 27 }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ rulesetId: 'HU-VAT-2026-006', netAmount: '100.00', vatAmount: '27.00', grossAmount: '127.00' });
  });

  it('returns a stable error envelope for invalid requests', async () => {
    const response = await app().inject({ method: 'GET', url: '/v1/hu/vat/rates' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'invalid_request', message: expect.any(String), requestId: expect.any(String) } });
  });

  it('fails closed on an unverified future effective date', async () => {
    const response = await app().inject({ method: 'GET', url: '/v1/hu/vat/rates?effectiveDate=2026-09-02' });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: { code: 'unsupported_effective_date' } });
  });
});
