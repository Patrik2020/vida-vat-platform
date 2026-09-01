import { describe, expect, it } from 'vitest';
import {
  HUNGARY_VAT_RULESET,
  calculateHungaryVat,
  classifyHungaryVatRate,
  evaluateAamThreshold2026,
  evaluateDomesticConstructionReverseCharge,
  getHungaryVatRates,
  resolvePeriodicTaxPoint
} from './index.js';

describe('Hungary VAT Phase 1 rules', () => {
  it('exposes 0, 5, 18 and 27 percent rates for 2026', () => {
    const result = getHungaryVatRates('2026-09-01');
    expect(result.rulesetId).toBe('HU-VAT-2026-004');
    expect(result.rates.map((entry) => entry.rate)).toEqual([27, 18, 5, 0]);
  });

  it('classifies qualifying daily newspapers at 0%', () => {
    const result = classifyHungaryVatRate('2026-08-31', { kind: 'daily_newspaper', customsTariffCode: '4902', issuesPerWeek: 5 });
    expect(result.status).toBe('classified');
    if (result.status === 'classified') expect(result.rate).toBe(0);
  });

  it('classifies qualifying prescription medicine at 0% from 2026-09-01 only', () => {
    const before = classifyHungaryVatRate('2026-08-31', { kind: 'medicine', prescriptionRequired: true, magistral: false, humanUse: true });
    const onDate = classifyHungaryVatRate('2026-09-01', { kind: 'medicine', prescriptionRequired: true, magistral: false, humanUse: true });
    expect(before.status).toBe('manual_review');
    expect(onDate.status).toBe('classified');
    if (onDate.status === 'classified') expect(onDate.rate).toBe(0);
  });

  it('classifies a supported 1904 cereal preparation at 18% only with confirmed statutory description', () => {
    const result = classifyHungaryVatRate('2026-09-01', {
      kind: 'reduced_rate_18_product', category: 'cereal_flour_starch_or_milk_preparation', customsTariffCode: '1904 10 10', statutoryDescriptionConfirmed: true
    });
    expect(result.status).toBe('classified');
    if (result.status === 'classified') expect(result.rate).toBe(18);

    expect(classifyHungaryVatRate('2026-09-01', {
      kind: 'reduced_rate_18_product', category: 'cereal_flour_starch_or_milk_preparation', customsTariffCode: '1904 10 10', statutoryDescriptionConfirmed: false
    }).status).toBe('manual_review');
  });

  it('classifies a supported 2026 domesticated cattle food product at 5%', () => {
    const result = classifyHungaryVatRate('2026-09-01', {
      kind: 'domesticated_cattle_food_product', customsTariffCode: '0201 30 00', domesticatedCattle: true, fitForHumanConsumption: true, preservation: 'chilled'
    });
    expect(result.status).toBe('classified');
    if (result.status === 'classified') expect(result.rate).toBe(5);
  });

  it('does not classify salted cattle products under the supported 5% rule', () => {
    expect(classifyHungaryVatRate('2026-09-01', {
      kind: 'domesticated_cattle_food_product', customsTariffCode: '0201 30 00', domesticatedCattle: true, fitForHumanConsumption: true, preservation: 'salted_or_brined'
    }).status).toBe('manual_review');
  });

  it('calculates VAT exactly from net and gross amounts', () => {
    expect(calculateHungaryVat({ effectiveDate: '2026-09-01', amount: '100.00', amountType: 'net', treatment: 'taxable', rate: 27 }))
      .toMatchObject({ rulesetId: 'HU-VAT-2026-004', netAmount: '100.00', vatAmount: '27.00', grossAmount: '127.00' });
    expect(calculateHungaryVat({ effectiveDate: '2026-09-01', amount: '127.00', amountType: 'gross', treatment: 'taxable', rate: 27 }))
      .toMatchObject({ rulesetId: 'HU-VAT-2026-004', netAmount: '100.00', vatAmount: '27.00', grossAmount: '127.00' });
  });

  it('does not charge seller VAT for reverse charge', () => {
    expect(calculateHungaryVat({ effectiveDate: '2026-09-01', amount: '100.00', amountType: 'net', treatment: 'reverse_charge' }))
      .toMatchObject({ vatAmount: '0.00', sellerChargesVat: false, recipientAccountingRequired: true });
  });

  it('resolves periodic tax points and fails closed outside the verification window', () => {
    expect(resolvePeriodicTaxPoint({ periodEnd: '2026-08-31', invoiceDate: '2026-08-20', dueDate: '2026-08-25' })).toMatchObject({ rulesetId: 'HU-VAT-2026-004', taxPoint: '2026-08-20' });
    expect(resolvePeriodicTaxPoint({ periodEnd: '2026-06-30', invoiceDate: '2026-06-30', dueDate: '2026-11-01' }).taxPoint).toBe('2026-08-29');
    expect(() => resolvePeriodicTaxPoint({ periodEnd: '2026-07-31', invoiceDate: '2026-07-31', dueDate: '2026-11-01' })).toThrow(/verified only through/);
  });

  it('evaluates the supported construction reverse-charge facts', () => {
    expect(evaluateDomesticConstructionReverseCharge({
      effectiveDate: '2026-09-01', supplierDomesticVatRegistered: true, recipientDomesticVatRegistered: true,
      supplierTaxPayableStatus: true, recipientTaxPayableStatus: true, constructionAssemblyWork: true,
      propertyActivity: 'transform', authorityPermitOrNotificationRequired: true, requiredDeclarationProvided: true
    })).toMatchObject({ rulesetId: 'HU-VAT-2026-004', eligible: true });
  });

  it('treats 19m prior-year turnover as within the 2026 AAM 20m threshold', () => {
    const result = evaluateAamThreshold2026({
      effectiveDate: '2026-09-01', establishedBefore2026: true, valuesCalculatedUnderSection188: true,
      priorYearRelevantDomesticTurnoverHuf: '19000000', currentYearExpectedRelevantDomesticTurnoverHuf: '19500000', currentYearActualRelevantDomesticTurnoverHuf: '12000000'
    });
    expect(result).toMatchObject({ status: 'eligible_within_threshold', thresholdMode: 'annual', thresholdHuf: '20000000', choiceEligible: true });
  });

  it('detects when the 2026 AAM threshold has already been exceeded', () => {
    const result = evaluateAamThreshold2026({
      effectiveDate: '2026-09-01', establishedBefore2026: true, valuesCalculatedUnderSection188: true,
      priorYearRelevantDomesticTurnoverHuf: '19000000', currentYearExpectedRelevantDomesticTurnoverHuf: '20000000', currentYearActualRelevantDomesticTurnoverHuf: '20000001'
    });
    expect(result).toMatchObject({ status: 'threshold_exceeded', thresholdExceededInCurrentYear: true });
  });

  it('calculates the exact section 189 threshold for a business registered on 2026-07-01', () => {
    const result = evaluateAamThreshold2026({
      effectiveDate: '2026-09-01', establishedBefore2026: false, registrationDate: '2026-07-01', valuesCalculatedUnderSection188: true,
      priorYearRelevantDomesticTurnoverHuf: '0', currentYearExpectedRelevantDomesticTurnoverHuf: '10082191', currentYearActualRelevantDomesticTurnoverHuf: '5000000'
    });
    expect(result).toMatchObject({
      rulesetId: 'HU-VAT-2026-004', status: 'eligible_within_threshold', thresholdMode: 'time_proportional', thresholdHuf: '10082191',
      registrationDate: '2026-07-01', activeDays: 184, daysInYear: 365, choiceEligible: true
    });
  });

  it('uses the exact fraction rather than a rounded display threshold at the section 189 boundary', () => {
    const result = evaluateAamThreshold2026({
      effectiveDate: '2026-09-01', establishedBefore2026: false, registrationDate: '2026-07-01', valuesCalculatedUnderSection188: true,
      priorYearRelevantDomesticTurnoverHuf: '0', currentYearExpectedRelevantDomesticTurnoverHuf: '10082192', currentYearActualRelevantDomesticTurnoverHuf: '0'
    });
    expect(result).toMatchObject({ status: 'not_eligible_for_choice', thresholdHuf: '10082191', choiceEligible: false });
  });

  it('returns manual review for new businesses if registrationDate is missing', () => {
    expect(evaluateAamThreshold2026({
      effectiveDate: '2026-09-01', establishedBefore2026: false, valuesCalculatedUnderSection188: true,
      priorYearRelevantDomesticTurnoverHuf: '0', currentYearExpectedRelevantDomesticTurnoverHuf: '5000000', currentYearActualRelevantDomesticTurnoverHuf: '1000000'
    }).status).toBe('manual_review');
  });

  it('rejects a registration date after the effective date', () => {
    expect(() => evaluateAamThreshold2026({
      effectiveDate: '2026-09-01', establishedBefore2026: false, registrationDate: '2026-10-01', valuesCalculatedUnderSection188: true,
      priorYearRelevantDomesticTurnoverHuf: '0', currentYearExpectedRelevantDomesticTurnoverHuf: '1', currentYearActualRelevantDomesticTurnoverHuf: '0'
    })).toThrow(/registrationDate cannot be later/);
  });

  it('has registered source metadata and fails closed after verification', () => {
    expect(HUNGARY_VAT_RULESET.sources.length).toBeGreaterThanOrEqual(8);
    expect(() => getHungaryVatRates('2026-09-02')).toThrow(/verified only through/);
  });
});
