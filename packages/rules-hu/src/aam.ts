import { assertSupportedDate } from './rates.js';

const AAM_2026_THRESHOLD_HUF = 20_000_000n;

export type AamThreshold2026Input = {
  effectiveDate: string;
  establishedBefore2026: boolean;
  valuesCalculatedUnderSection188: boolean;
  priorYearRelevantDomesticTurnoverHuf: string;
  currentYearExpectedRelevantDomesticTurnoverHuf: string;
  currentYearActualRelevantDomesticTurnoverHuf: string;
};

function parseWholeHuf(value: string, field: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${field} must be a non-negative whole-forint string`);
  }
  return BigInt(value);
}

export function evaluateAamThreshold2026(input: AamThreshold2026Input) {
  assertSupportedDate(input.effectiveDate);

  if (!input.effectiveDate.startsWith('2026-')) {
    throw new Error('This evaluator currently supports tax year 2026 only.');
  }

  if (!input.establishedBefore2026) {
    return {
      rulesetId: 'HU-VAT-2026-003',
      effectiveDate: input.effectiveDate,
      status: 'manual_review' as const,
      reason: 'Newly registered taxpayers use a time-proportional current-year threshold under Áfa tv. 189. §; that calculation is not implemented in this MVP evaluator.',
      thresholdHuf: AAM_2026_THRESHOLD_HUF.toString(),
      sourceIds: ['HU-AFA-TV', 'NAV-SME-EXEMPTION-2026']
    };
  }

  if (!input.valuesCalculatedUnderSection188) {
    return {
      rulesetId: 'HU-VAT-2026-003',
      effectiveDate: input.effectiveDate,
      status: 'manual_review' as const,
      reason: 'Turnover inputs must already reflect the inclusions/exclusions required by Áfa tv. 188. § (3).',
      thresholdHuf: AAM_2026_THRESHOLD_HUF.toString(),
      sourceIds: ['HU-AFA-TV', 'NAV-SME-EXEMPTION-2026']
    };
  }

  const prior = parseWholeHuf(input.priorYearRelevantDomesticTurnoverHuf, 'priorYearRelevantDomesticTurnoverHuf');
  const expected = parseWholeHuf(input.currentYearExpectedRelevantDomesticTurnoverHuf, 'currentYearExpectedRelevantDomesticTurnoverHuf');
  const actual = parseWholeHuf(input.currentYearActualRelevantDomesticTurnoverHuf, 'currentYearActualRelevantDomesticTurnoverHuf');

  const priorWithinThreshold = prior <= AAM_2026_THRESHOLD_HUF;
  const expectedWithinThreshold = expected <= AAM_2026_THRESHOLD_HUF;
  const actualWithinThreshold = actual <= AAM_2026_THRESHOLD_HUF;
  const choiceEligible = priorWithinThreshold && expectedWithinThreshold;

  const status = !choiceEligible
    ? 'not_eligible_for_choice'
    : !actualWithinThreshold
      ? 'threshold_exceeded'
      : 'eligible_within_threshold';

  return {
    rulesetId: 'HU-VAT-2026-003',
    effectiveDate: input.effectiveDate,
    status,
    thresholdHuf: AAM_2026_THRESHOLD_HUF.toString(),
    choiceEligible,
    thresholdExceededInCurrentYear: !actualWithinThreshold,
    checks: {
      priorYearRelevantTurnoverWithinThreshold: priorWithinThreshold,
      currentYearExpectedRelevantTurnoverWithinThreshold: expectedWithinThreshold,
      currentYearActualRelevantTurnoverWithinThreshold: actualWithinThreshold
    },
    values: {
      priorYearRelevantDomesticTurnoverHuf: prior.toString(),
      currentYearExpectedRelevantDomesticTurnoverHuf: expected.toString(),
      currentYearActualRelevantDomesticTurnoverHuf: actual.toString()
    },
    legalBasis: 'Áfa tv. 188. §; 2026. évi 20 000 000 Ft értékhatár',
    sourceIds: ['HU-AFA-TV', 'NAV-SME-EXEMPTION-2026'],
    notice: 'This evaluator checks the 2026 turnover threshold only. It does not yet determine the exact transaction that terminates exemption, re-election restrictions, or special exclusions unless those were already reflected in the supplied §188 turnover values.'
  };
}
