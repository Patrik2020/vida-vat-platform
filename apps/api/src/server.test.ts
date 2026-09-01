import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from './server.js';

const apps: ReturnType<typeof buildServer>[] = [];
function app() { const instance = buildServer(); apps.push(instance); return instance; }
afterEach(async () => { await Promise.all(apps.splice(0).map((instance) => instance.close())); });

describe('Hungary VAT API Phase 1', () => {
  it('returns the current rate catalogue including 0%', async () => {
    const response = await app().inject({ method: 'GET', url: '/v1/hu/vat/rates?effectiveDate=2026-09-01' });
    expect(response.statusCode).toBe(200);
    expect(response.json().rulesetId).toBe('HU-VAT-2026-004');
  });

  it('publishes the OpenAPI 3.0 contract and Swagger JSON', async () => {
    const direct = await app().inject({ method: 'GET', url: '/openapi.json' });
    expect(direct.statusCode).toBe(200);
    expect(direct.json()).toMatchObject({ openapi: '3.0.3', info: { version: '0.4.0' } });

    const swagger = await app().inject({ method: 'GET', url: '/docs/json' });
    expect(swagger.statusCode).toBe(200);
    expect(swagger.json().paths).toHaveProperty('/v1/hu/vat/exemptions/aam/threshold');
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
      rulesetId: 'HU-VAT-2026-004', status: 'eligible_within_threshold', thresholdMode: 'time_proportional', thresholdHuf: '10082191', activeDays: 184, daysInYear: 365
    });
  });

  it('calculates 27% VAT from net with the active ruleset id', async () => {
    const response = await app().inject({
      method: 'POST', url: '/v1/hu/vat/calculate',
      payload: { effectiveDate: '2026-09-01', amount: '100.00', amountType: 'net', treatment: 'taxable', rate: 27 }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ rulesetId: 'HU-VAT-2026-004', netAmount: '100.00', vatAmount: '27.00', grossAmount: '127.00' });
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
