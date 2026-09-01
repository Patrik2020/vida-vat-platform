import { assertIsoDate } from './date-utils.js';
import { HUNGARY_VAT_SOURCES } from './sources.js';
import type { HungaryVatRate, RateClassificationResult } from './types.js';

export const HUNGARY_VAT_RULESET = {
  id: 'HU-VAT-2026-006',
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
  | {
      kind: 'reduced_rate_18_product';
      category: 'milk_or_dairy' | 'flavored_milk' | 'cereal_flour_starch_or_milk_preparation';
      customsTariffCode: string;
      statutoryDescriptionConfirmed: boolean;
    }
  | {
      kind: 'domesticated_cattle_food_product';
      customsTariffCode: string;
      domesticatedCattle: boolean;
      fitForHumanConsumption: boolean;
      preservation: 'fresh' | 'chilled' | 'frozen' | 'salted_or_brined' | 'dried' | 'smoked' | 'other';
    }
  | { kind: 'declared_rate'; rate: HungaryVatRate; legalBasisConfirmed: boolean };

function normalizeTariffCode(value: string): string {
  return value.replace(/\D/g, '');
}

function manualReview(effectiveDate: string, reason: string, sourceIds: string[]): RateClassificationResult {
  return { status: 'manual_review', reason, effectiveDate, sourceIds };
}

function matches18PercentSupportedSubset(category: Extract<ClassificationInput, { kind: 'reduced_rate_18_product' }>['category'], code: string): boolean {
  if (category === 'milk_or_dairy') {
    return code.startsWith('0402') || code.startsWith('0403') || code.startsWith('040410') || code.startsWith('0405') || code.startsWith('0406');
  }
  if (category === 'flavored_milk') {
    return code.startsWith('22029991') || code.startsWith('22029995') || code.startsWith('22029999');
  }
  return code.startsWith('1903') || code.startsWith('1904') || code.startsWith('190510') || code.startsWith('190540') || code.startsWith('190590');
}

const CATTLE_5_PERCENT_CODES = [
  '02012090', '02013000', '02022090', '02023050', '02023090', '020610', '02062100', '02062200', '020629'
] as const;

function matchesCattle5PercentCode(code: string): boolean {
  return CATTLE_5_PERCENT_CODES.some((candidate) => code.startsWith(candidate));
}

export function classifyHungaryVatRate(effectiveDate: string, input: ClassificationInput): RateClassificationResult {
  assertSupportedDate(effectiveDate);

  if (input.kind === 'daily_newspaper') {
    const normalizedCode = normalizeTariffCode(input.customsTariffCode);
    if (normalizedCode.startsWith('4902') && input.issuesPerWeek >= 4) {
      return {
        status: 'classified', rate: 0, classificationCode: 'ZERO_DAILY_NEWSPAPER',
        legalBasis: '0%-os adómérték; vtsz. 4902 alá tartozó, hetente legalább négyszer megjelenő napilap',
        sourceIds: ['HU-AFA-TV', 'NAV-ZERO-NEWSPAPER-2024'], effectiveDate
      };
    }
    return manualReview(effectiveDate, 'The supplied newspaper facts do not prove the statutory 0% conditions. No fallback rate is inferred.', ['NAV-ZERO-NEWSPAPER-2024']);
  }

  if (input.kind === 'medicine') {
    if (effectiveDate >= '2026-09-01' && input.humanUse && (input.prescriptionRequired || input.magistral)) {
      return {
        status: 'classified', rate: 0,
        classificationCode: input.magistral ? 'ZERO_HUMAN_MAGISTRAL_MEDICINE' : 'ZERO_PRESCRIPTION_MEDICINE',
        legalBasis: '2026. szeptember 1-jétől alkalmazható 0%-os gyógyszer-adómérték',
        sourceIds: ['HU-AFA-TV', 'NAV-ZERO-MEDICINE-2026'], effectiveDate
      };
    }
    return manualReview(effectiveDate, 'The supplied medicine facts/date do not prove a supported 0% classification. No fallback rate is inferred.', ['NAV-ZERO-MEDICINE-2026']);
  }

  if (input.kind === 'reduced_rate_18_product') {
    const code = normalizeTariffCode(input.customsTariffCode);
    if (!input.statutoryDescriptionConfirmed) {
      return manualReview(effectiveDate, '18% requires both the statutory product description and the referenced tariff classification to match.', ['HU-AFA-TV', 'NAV-RATE-18-2026']);
    }
    if (matches18PercentSupportedSubset(input.category, code)) {
      return {
        status: 'classified', rate: 18,
        classificationCode: `REDUCED_18_${input.category.toUpperCase()}`,
        legalBasis: 'Áfa tv. 82. § (3), 3/A. számú melléklet I. rész; supported NAV 2026/1 subset',
        sourceIds: ['HU-AFA-TV', 'NAV-RATE-18-2026'], effectiveDate
      };
    }
    return manualReview(effectiveDate, 'The tariff code is outside the currently automated 18% subset. The API does not infer a fallback rate.', ['HU-AFA-TV', 'NAV-RATE-18-2026']);
  }

  if (input.kind === 'domesticated_cattle_food_product') {
    const code = normalizeTariffCode(input.customsTariffCode);
    const qualifyingPreservation = input.preservation === 'fresh' || input.preservation === 'chilled' || input.preservation === 'frozen';
    if (effectiveDate >= '2026-01-01' && input.domesticatedCattle && input.fitForHumanConsumption && qualifyingPreservation && matchesCattle5PercentCode(code)) {
      return {
        status: 'classified', rate: 5, classificationCode: 'REDUCED_5_DOMESTICATED_CATTLE_FOOD_PRODUCT_2026',
        legalBasis: 'Áfa tv. 82. § (2), 3. számú melléklet I. rész 60. sor',
        sourceIds: ['HU-AFA-TV', 'NAV-RATE-5-CATTLE-2026'], effectiveDate
      };
    }
    return manualReview(effectiveDate, 'The supplied cattle-product facts do not prove the supported 5% conditions. Salted/brined, dried or smoked products are not classified by this rule.', ['HU-AFA-TV', 'NAV-RATE-5-CATTLE-2026']);
  }

  if (!input.legalBasisConfirmed) {
    return manualReview(effectiveDate, 'A declared reduced/zero rate is accepted only when the caller confirms the legal classification basis.', ['HU-AFA-TV']);
  }

  return {
    status: 'classified', rate: input.rate, classificationCode: `DECLARED_RATE_${input.rate}`,
    legalBasis: 'Caller-confirmed legal classification; arithmetic validation only.', sourceIds: ['HU-AFA-TV'], effectiveDate
  };
}
