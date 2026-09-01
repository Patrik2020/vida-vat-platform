import { describe, expect, it } from 'vitest';
import {
  HUNGARY_VAT_RULESET,
  calculateHungaryVat,
  classifyHungaryVatRate,
  evaluateDomesticConstructionReverseCharge,
  getHungaryVatRates,
  resolvePeriodicTaxPoint
} from './index.js';

describe('Hungary VAT Phase 1 rules', () => {
  it('exposes 0, 5, 18 and 27 percent rates for 2026', () => {
    const result = getHungaryVatRates('2026-09-01');
    expect(result.rulesetId).toBe('HU-VAT-2026-002');
    expect(result.rates.map((entry) => entry.rate)).toEqual([27, 18, 5, 0]);
    expect(result.classificationSupported).toBe('partial');
  });

  it('keeps the 0 percent rate in the catalogue before September because qualifying newspapers already had 0%', () => {
    expect(getHungaryVatRates('2026-01-01').rates.some((entry) => entry.rate === 0)).toBe(true);
  });

  it('classifies qualifying daily newspapers at 0%', () => {
    const result = classifyHungaryVatRate('2026-08-31', {
      kind: 'daily_newspaper', customsTariffCode: '4902', issuesPerWeek: 5
    });
    expect(result.status).toBe('classified');
    if (result.status === 'classified') expect(result.rate).toBe(0);
  });

  it('classifies qualifying prescription medicine at 0% from 2026-09-01 only', () => {
    const before = classifyHungaryVatRate('2026-08-31', {
      kind: 'medicine', prescriptionRequired: true, magistral: false, humanUse: true
    });
    const onDate = classifyHungaryVatRate('2026-09-01', {
      kind: 'medicine', prescriptionRequired: true, magistral: false, humanUse: true
    });
    expect(before.status).toBe('manual_review');
    expect(onDate.status).toBe('classified');
    if (onDate.status === 'classified') expect(onDate.rate).toBe(0);
  });

  it('never guesses a fallback rate when classification facts are insufficient', () => {
    const result = classifyHungaryVatRate('2026-09-01', {
      kind: 'daily_newspaper', customsTariffCode: '9999', issuesPerWeek: 1
    });
    expect(result.status).toBe('manual_review');
  });

  it('calculates VAT exactly from a net amount', () => {
    expect(calculateHungaryVat({
      effectiveDate: '2026-09-01', amount: '100.00', amountType: 'net', treatment: 'taxable', rate: 27
    })).toMatchObject({ netAmount: '100.00', vatAmount: '27.00', grossAmount: '127.00' });
  });

  it('calculates VAT exactly from a gross amount', () => {
    expect(calculateHungaryVat({
      effectiveDate: '2026-09-01', amount: '127.00', amountType: 'gross', treatment: 'taxable', rate: 27
    })).toMatchObject({ netAmount: '100.00', vatAmount: '27.00', grossAmount: '127.00' });
  });

  it('does not charge seller VAT for reverse charge', () => {
    expect(calculateHungaryVat({
      effectiveDate: '2026-09-01', amount: '100.00', amountType: 'net', treatment: 'reverse_charge'
    })).toMatchObject({ vatAmount: '0.00', sellerChargesVat: false, recipientAccountingRequired: true });
  });

  it('resolves periodic tax points under the 58 § rules', () => {
    expect(resolvePeriodicTaxPoint({ periodEnd: '2026-08-31', invoiceDate: '2026-08-20', dueDate: '2026-08-25' }).taxPoint).toBe('2026-08-20');
    expect(resolvePeriodicTaxPoint({ periodEnd: '2026-06-30', invoiceDate: '2026-06-30', dueDate: '2026-11-01' }).taxPoint).toBe('2026-08-29');
  });

  it('fails closed if a computed periodic tax point falls after the verified window', () => {
    expect(() => resolvePeriodicTaxPoint({
      periodEnd: '2026-07-31', invoiceDate: '2026-07-31', dueDate: '2026-11-01'
    })).toThrow(/verified only through/);
  });

  it('evaluates the supported construction reverse-charge facts', () => {
    const result = evaluateDomesticConstructionReverseCharge({
      effectiveDate: '2026-09-01',
      supplierDomesticVatRegistered: true,
      recipientDomesticVatRegistered: true,
      supplierTaxPayableStatus: true,
      recipientTaxPayableStatus: true,
      constructionAssemblyWork: true,
      propertyActivity: 'transform',
      authorityPermitOrNotificationRequired: true,
      requiredDeclarationProvided: true
    });
    expect(result.eligible).toBe(true);
  });

  it('has registered source metadata', () => {
    expect(HUNGARY_VAT_RULESET.sources.length).toBeGreaterThanOrEqual(7);
  });

  it('fails closed after the regulatory verification date', () => {
    expect(() => getHungaryVatRates('2026-09-02')).toThrow(/verified only through/);
  });
});
