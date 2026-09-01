import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from './server.js';

const apps: ReturnType<typeof buildServer>[] = [];
function app() { const instance = buildServer(); apps.push(instance); return instance; }
afterEach(async () => { await Promise.all(apps.splice(0).map((instance) => instance.close())); });

describe('Hungary VAT API Phase 1', () => {
  it('returns the current rate catalogue including 0%', async () => {
    const response = await app().inject({ method: 'GET', url: '/v1/hu/vat/rates?effectiveDate=2026-09-01' });
    expect(response.statusCode).toBe(200);
    expect(response.json().rulesetId).toBe('HU-VAT-2026-003');
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

  it('evaluates the 2026 AAM threshold', async () => {
    const response = await app().inject({
      method: 'POST', url: '/v1/hu/vat/exemptions/aam/threshold',
      payload: {
        effectiveDate: '2026-09-01', establishedBefore2026: true, valuesCalculatedUnderSection188: true,
        priorYearRelevantDomesticTurnoverHuf: '19000000', currentYearExpectedRelevantDomesticTurnoverHuf: '19500000', currentYearActualRelevantDomesticTurnoverHuf: '10000000'
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'eligible_within_threshold', thresholdHuf: '20000000' });
  });

  it('calculates 27% VAT from net', async () => {
    const response = await app().inject({
      method: 'POST', url: '/v1/hu/vat/calculate',
      payload: { effectiveDate: '2026-09-01', amount: '100.00', amountType: 'net', treatment: 'taxable', rate: 27 }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ netAmount: '100.00', vatAmount: '27.00', grossAmount: '127.00' });
  });

  it('fails closed on an unverified future effective date', async () => {
    const response = await app().inject({ method: 'GET', url: '/v1/hu/vat/rates?effectiveDate=2026-09-02' });
    expect(response.statusCode).toBe(422);
  });
});
