import { assertIsoDate } from './date-utils.js';
import { HUNGARY_VAT_SOURCES } from './sources.js';
import type { HungaryVatRate, RateClassificationResult } from './types.js';

export const HUNGARY_VAT_RULESET = {
  id: 'HU-VAT-2026-002',
  jurisdiction: 'HU',
  validFrom: '2026-01-01',
  verifiedThrough: '2026-09-01',
  rates: [
    { rate: 27, kind: 'standard', legalBasis: 'Áfa tv. 82. § (1)', sourceIds: ['HU-AFA-TV'] },
    { rate: 18, kind: 'reduced', legalBasis: 'Áfa tv. 82. § (3), 3/A. számú melléklet', sourceIds: ['HU-AFA-TV', 'NAV-RATE-18-2026'] },
    { rate: 5, kind: 'reduced', legalBasis: 'Áfa tv. 82. § (2), 3. számú melléklet', sourceIds: ['HU-AFA-TV', 'NAV-RATE-5-CATTLE-2026'] },
    { rate: 0, kind: 'zero', legalBasis: 'Áfa tv. szerinti 0%-os körök; alkalmazhatóság tételes feltételekhez kötött', sourceIds: ['HU-AFA-TV', 'NAV-ZERO-NEWSPAPER-2024', 'NAV-ZERO-MEDICINE-2026'] }
  ] as const,
  sources: HUNGARY_VAT_SOURCES
} as const;

export function assertSupportedDate(effectiveDate: string): void {
  assertIsoDate(effectiveDate);
  if (effectiveDate < HUNGARY_VAT_RULESET.validFrom) {
    throw new Error(`No Hungary VAT ruleset is loaded before ${HUNGARY_VAT_RULESET.validFrom}.`);
  }
  if (effectiveDate > HUNGARY_VAT_RULESET.verifiedThrough) {
    throw new Error(`Rules are verified only through ${HUNGARY_VAT_RULESET.verifiedThrough}. Refresh regulatory sources before using a later date.`);
  }
}

export function getHungaryVatRates(effectiveDate: string) {
  assertSupportedDate(effectiveDate);
  return {
    rulesetId: HUNGARY_VAT_RULESET.id,
    jurisdiction: HUNGARY_VAT_RULESET.jurisdiction,
    effectiveDate,
    verifiedThrough: HUNGARY_VAT_RULESET.verifiedThrough,
    rates: HUNGARY_VAT_RULESET.rates,
    sources: HUNGARY_VAT_RULESET.sources,
    classificationSupported: 'partial' as const,
    notice: 'The rate catalogue includes 0%, 5%, 18% and 27%. Reduced/zero-rate applicability must be classified against statutory conditions; unsupported cases return manual_review.'
  };
}

type ClassificationInput =
  | { kind: 'daily_newspaper'; customsTariffCode: string; issuesPerWeek: number }
  | { kind: 'medicine'; prescriptionRequired: boolean; magistral: boolean; humanUse: boolean }
  | { kind: 'declared_rate'; rate: HungaryVatRate; legalBasisConfirmed: boolean };

export function classifyHungaryVatRate(effectiveDate: string, input: ClassificationInput): RateClassificationResult {
  assertSupportedDate(effectiveDate);

  if (input.kind === 'daily_newspaper') {
    const normalizedCode = input.customsTariffCode.replace(/\s/g, '');
    if (normalizedCode.startsWith('4902') && input.issuesPerWeek >= 4) {
      return {
        status: 'classified',
        rate: 0,
        classificationCode: 'ZERO_DAILY_NEWSPAPER',
        legalBasis: '0%-os adómérték; vtsz. 4902 alá tartozó, hetente legalább négyszer megjelenő napilap',
        sourceIds: ['HU-AFA-TV', 'NAV-ZERO-NEWSPAPER-2024'],
        effectiveDate
      };
    }
    return {
      status: 'manual_review',
      reason: 'The supplied newspaper facts do not prove the statutory 0% conditions. No fallback rate is inferred.',
      effectiveDate,
      sourceIds: ['NAV-ZERO-NEWSPAPER-2024']
    };
  }

  if (input.kind === 'medicine') {
    if (effectiveDate >= '2026-09-01' && input.humanUse && (input.prescriptionRequired || input.magistral)) {
      return {
        status: 'classified',
        rate: 0,
        classificationCode: input.magistral ? 'ZERO_HUMAN_MAGISTRAL_MEDICINE' : 'ZERO_PRESCRIPTION_MEDICINE',
        legalBasis: '2026. szeptember 1-jétől alkalmazható 0%-os gyógyszer-adómérték',
        sourceIds: ['HU-AFA-TV', 'NAV-ZERO-MEDICINE-2026'],
        effectiveDate
      };
    }
    return {
      status: 'manual_review',
      reason: 'The supplied medicine facts/date do not prove a supported 0% classification. No fallback rate is inferred.',
      effectiveDate,
      sourceIds: ['NAV-ZERO-MEDICINE-2026']
    };
  }

  if (!input.legalBasisConfirmed) {
    return {
      status: 'manual_review',
      reason: 'A declared reduced/zero rate is accepted only when the caller confirms the legal classification basis.',
      effectiveDate,
      sourceIds: ['HU-AFA-TV']
    };
  }

  return {
    status: 'classified',
    rate: input.rate,
    classificationCode: `DECLARED_RATE_${input.rate}`,
    legalBasis: 'Caller-confirmed legal classification; arithmetic validation only.',
    sourceIds: ['HU-AFA-TV'],
    effectiveDate
  };
}
