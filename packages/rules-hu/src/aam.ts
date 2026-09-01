import { assertIsoDate } from './date-utils.js';
import { HUNGARY_VAT_RULESET, assertSupportedDate } from './rates.js';

const AAM_2026_THRESHOLD_HUF = 20_000_000n;

export type AamThreshold2026Input = {
  effectiveDate: string;
  establishedBefore2026: boolean;
  registrationDate?: string | undefined;
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

function utcDate(value: string): Date {
  assertIsoDate(value);
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

function daysInclusive(from: string, through: string): number {
  const millis = utcDate(through).getTime() - utcDate(from).getTime();
  return Math.floor(millis / 86_400_000) + 1;
}

function daysInCalendarYear(year: number): number {
  return daysInclusive(`${year}-01-01`, `${year}-12-31`);
}

function withinProratedThreshold(value: bigint, activeDays: number, daysInYear: number): boolean {
  return value * BigInt(daysInYear) <= AAM_2026_THRESHOLD_HUF * BigInt(activeDays);
}

function baseManualReview(input: AamThreshold2026Input, reason: string) {
  return {
    rulesetId: HUNGARY_VAT_RULESET.id,
    effectiveDate: input.effectiveDate,
    status: 'manual_review' as const,
    reason,
    annualThresholdHuf: AAM_2026_THRESHOLD_HUF.toString(),
    sourceIds: ['HU-AFA-TV', 'NAV-SME-EXEMPTION-2026', 'NAV-AAM-TIME-PROPORTION-2026']
  };
}

export function evaluateAamThreshold2026(input: AamThreshold2026Input) {
  assertSupportedDate(input.effectiveDate);

  if (!input.effectiveDate.startsWith('2026-')) {
    throw new Error('This evaluator currently supports tax year 2026 only.');
  }

  if (!input.valuesCalculatedUnderSection188) {
    return baseManualReview(input, 'Turnover inputs must already reflect the inclusions/exclusions required by Áfa tv. 188. § (3).');
  }

  const prior = parseWholeHuf(input.priorYearRelevantDomesticTurnoverHuf, 'priorYearRelevantDomesticTurnoverHuf');
  const expected = parseWholeHuf(input.currentYearExpectedRelevantDomesticTurnoverHuf, 'currentYearExpectedRelevantDomesticTurnoverHuf');
  const actual = parseWholeHuf(input.currentYearActualRelevantDomesticTurnoverHuf, 'currentYearActualRelevantDomesticTurnoverHuf');

  if (!input.establishedBefore2026) {
    if (!input.registrationDate) {
      return baseManualReview(input, 'registrationDate is required to calculate the time-proportional threshold for a taxpayer registered during 2026 under Áfa tv. 189. §.');
    }

    assertIsoDate(input.registrationDate);
    if (!input.registrationDate.startsWith('2026-')) {
      throw new Error('registrationDate must fall in tax year 2026 when establishedBefore2026 is false.');
    }
    if (input.registrationDate > input.effectiveDate) {
      throw new Error('registrationDate cannot be later than effectiveDate.');
    }

    const year = 2026;
    const activeDays = daysInclusive(input.registrationDate, `${year}-12-31`);
    const daysInYear = daysInCalendarYear(year);
    const thresholdNumerator = AAM_2026_THRESHOLD_HUF * BigInt(activeDays);
    const thresholdFloorHuf = thresholdNumerator / BigInt(daysInYear);
    const expectedWithinThreshold = withinProratedThreshold(expected, activeDays, daysInYear);
    const actualWithinThreshold = withinProratedThreshold(actual, activeDays, daysInYear);
    const status = !expectedWithinThreshold
      ? 'not_eligible_for_choice'
      : !actualWithinThreshold
        ? 'threshold_exceeded'
        : 'eligible_within_threshold';

    return {
      rulesetId: HUNGARY_VAT_RULESET.id,
      effectiveDate: input.effectiveDate,
      status,
      thresholdMode: 'time_proportional' as const,
      annualThresholdHuf: AAM_2026_THRESHOLD_HUF.toString(),
      thresholdHuf: thresholdFloorHuf.toString(),
      thresholdExact: {
        numeratorHufDays: thresholdNumerator.toString(),
        denominatorDays: daysInYear.toString()
      },
      registrationDate: input.registrationDate,
      activeDays,
      daysInYear,
      choiceEligible: expectedWithinThreshold,
      thresholdExceededInCurrentYear: !actualWithinThreshold,
      checks: {
        currentYearExpectedRelevantTurnoverWithinThreshold: expectedWithinThreshold,
        currentYearActualRelevantTurnoverWithinThreshold: actualWithinThreshold
      },
      values: {
        priorYearRelevantDomesticTurnoverHuf: prior.toString(),
        currentYearExpectedRelevantDomesticTurnoverHuf: expected.toString(),
        currentYearActualRelevantDomesticTurnoverHuf: actual.toString()
      },
      legalBasis: 'Áfa tv. 188. § és 189. §; 2026. évi 20 000 000 Ft éves értékhatár időarányos része',
      sourceIds: ['HU-AFA-TV', 'NAV-SME-EXEMPTION-2026', 'NAV-AAM-TIME-PROPORTION-2026'],
      notice: 'For taxpayers registered during 2026, the annual threshold is prorated over the calendar days from registrationDate through 31 December, inclusive. Eligibility comparisons use the exact fraction; thresholdHuf is only its whole-forint floor for display.'
    };
  }

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
    rulesetId: HUNGARY_VAT_RULESET.id,
    effectiveDate: input.effectiveDate,
    status,
    thresholdMode: 'annual' as const,
    annualThresholdHuf: AAM_2026_THRESHOLD_HUF.toString(),
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
    notice: 'This evaluator checks the 2026 turnover threshold. It does not yet determine the exact transaction that terminates exemption, re-election restrictions, or special exclusions unless those were already reflected in the supplied §188 turnover values.'
  };
}
