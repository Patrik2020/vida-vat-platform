import { describe, expect, it } from 'vitest';
import { getHungaryVatRates, HUNGARY_VAT_RULESET } from './index.js';

describe('Hungary VAT ruleset', () => {
  it('exposes the verified 2026 VAT rates', () => {
    const result = getHungaryVatRates('2026-09-01');

    expect(result.rulesetId).toBe('HU-VAT-2026-001');
    expect(result.rates.map((entry) => entry.rate)).toEqual([27, 18, 5]);
    expect(result.classificationSupported).toBe(false);
  });

  it('rejects dates before the loaded ruleset', () => {
    expect(() => getHungaryVatRates('2025-12-31')).toThrow(/No Hungary VAT ruleset/);
  });

  it('rejects dates later than the latest regulatory verification', () => {
    expect(() => getHungaryVatRates('2026-09-02')).toThrow(/verified only through/);
  });

  it('has source metadata for every rate', () => {
    const sourceIds = new Set(HUNGARY_VAT_RULESET.sources.map((source) => source.id));

    for (const rate of HUNGARY_VAT_RULESET.rates) {
      expect(sourceIds.has(rate.sourceId)).toBe(true);
    }
  });
});
