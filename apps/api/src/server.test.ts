import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from './server.js';

const apps: ReturnType<typeof buildServer>[] = [];
function app() { const instance = buildServer(); apps.push(instance); return instance; }
afterEach(async () => { await Promise.all(apps.splice(0).map((instance) => instance.close())); });

describe('Hungary VAT API MVP', () => {
  it('returns the current rate catalogue including 0%', async () => {
    const response = await app().inject({ method: 'GET', url: '/v1/hu/vat/rates?effectiveDate=2026-09-01' });
    expect(response.statusCode).toBe(200);
    expect(response.json().rates.map((item: { rate: number }) => item.rate)).toEqual([27, 18, 5, 0]);
  });

  it('classifies current prescription medicine at 0%', async () => {
    const response = await app().inject({
      method: 'POST', url: '/v1/hu/vat/classify-rate',
      payload: { effectiveDate: '2026-09-01', classification: { kind: 'medicine', prescriptionRequired: true, magistral: false, humanUse: true } }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'classified', rate: 0 });
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
