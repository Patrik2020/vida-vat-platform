import Fastify from 'fastify';
import { z } from 'zod';
import {
  calculateHungaryVat,
  classifyHungaryVatRate,
  evaluateDomesticConstructionReverseCharge,
  getHungaryVatRates,
  resolvePeriodicTaxPoint
} from '@vida/rules-hu';

const isoDate = z.iso.date();

export function buildServer() {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok', service: 'vida-vat-platform', version: '0.2.0' }));

  app.get('/v1/hu/vat/rates', async (request, reply) => {
    const parsed = z.object({ effectiveDate: isoDate }).safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', message: 'effectiveDate is required in YYYY-MM-DD format' });
    try { return getHungaryVatRates(parsed.data.effectiveDate); }
    catch (error) { return reply.code(422).send({ error: 'unsupported_effective_date', message: error instanceof Error ? error.message : 'Unsupported effective date' }); }
  });

  app.post('/v1/hu/vat/classify-rate', async (request, reply) => {
    const inputSchema = z.object({
      effectiveDate: isoDate,
      classification: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('daily_newspaper'), customsTariffCode: z.string().min(1), issuesPerWeek: z.number().int().nonnegative() }),
        z.object({ kind: z.literal('medicine'), prescriptionRequired: z.boolean(), magistral: z.boolean(), humanUse: z.boolean() }),
        z.object({ kind: z.literal('declared_rate'), rate: z.union([z.literal(0), z.literal(5), z.literal(18), z.literal(27)]), legalBasisConfirmed: z.boolean() })
      ])
    }).safeParse(request.body);
    if (!inputSchema.success) return reply.code(400).send({ error: 'invalid_request', details: inputSchema.error.issues });
    try { return classifyHungaryVatRate(inputSchema.data.effectiveDate, inputSchema.data.classification); }
    catch (error) { return reply.code(422).send({ error: 'classification_failed', message: error instanceof Error ? error.message : 'Classification failed' }); }
  });

  app.post('/v1/hu/vat/calculate', async (request, reply) => {
    const parsed = z.object({
      effectiveDate: isoDate,
      amount: z.string().regex(/^\d+(\.\d+)?$/),
      amountType: z.enum(['net', 'gross']),
      treatment: z.enum(['taxable', 'exempt', 'reverse_charge']),
      rate: z.union([z.literal(0), z.literal(5), z.literal(18), z.literal(27)]).optional(),
      scale: z.number().int().min(0).max(6).optional()
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.issues });
    try { return calculateHungaryVat(parsed.data); }
    catch (error) { return reply.code(422).send({ error: 'calculation_failed', message: error instanceof Error ? error.message : 'Calculation failed' }); }
  });

  app.post('/v1/hu/vat/tax-point/periodic', async (request, reply) => {
    const parsed = z.object({ periodEnd: isoDate, invoiceDate: isoDate, dueDate: isoDate }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.issues });
    try { return resolvePeriodicTaxPoint(parsed.data); }
    catch (error) { return reply.code(422).send({ error: 'tax_point_failed', message: error instanceof Error ? error.message : 'Tax point resolution failed' }); }
  });

  app.post('/v1/hu/vat/reverse-charge/domestic-construction', async (request, reply) => {
    const parsed = z.object({
      effectiveDate: isoDate,
      supplierDomesticVatRegistered: z.boolean(),
      recipientDomesticVatRegistered: z.boolean(),
      supplierTaxPayableStatus: z.boolean(),
      recipientTaxPayableStatus: z.boolean(),
      constructionAssemblyWork: z.boolean(),
      propertyActivity: z.enum(['create', 'expand', 'transform', 'demolish', 'change_purpose', 'other']),
      authorityPermitOrNotificationRequired: z.boolean(),
      requiredDeclarationProvided: z.boolean()
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.issues });
    try { return evaluateDomesticConstructionReverseCharge(parsed.data); }
    catch (error) { return reply.code(422).send({ error: 'reverse_charge_evaluation_failed', message: error instanceof Error ? error.message : 'Reverse-charge evaluation failed' }); }
  });

  return app;
}

const app = buildServer();
if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  app.listen({ port, host }).catch((error) => { app.log.error(error); process.exit(1); });
}
