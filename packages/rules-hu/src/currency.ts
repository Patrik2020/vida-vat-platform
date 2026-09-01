import { assertIsoDate } from './date-utils.js';
import { formatFixedScale, parseDecimal, powerOfTen, roundFractionToScale } from './decimal.js';
import { HUNGARY_VAT_RULESET, assertSupportedDate } from './rates.js';

type TaxDeterminationTransaction = {
  kind: 'intra_community_acquisition' | 'advance_payment' | 'section_60';
  taxLiabilityDeterminationDate: string;
};

type CurrencyTransaction =
  | TaxDeterminationTransaction
  | { kind: 'periodic_settlement_section_58'; invoiceIssueDate: string }
  | { kind: 'other'; performanceDate: string };

type OfficialRateElectionEvidence = {
  electionDeclaredToNavBeforeUse: boolean;
  electionAppliesToAllForeignCurrencyTransactions: boolean;
  electionLockInObserved: boolean;
  exclusiveMnbOrEcbChoiceConfirmed: boolean;
};

type DirectRateEvidence = {
  quotedCurrencyUnits: string;
  hufAmount: string;
  ratePublicationDate: string;
  latestValidRateConfirmed: boolean;
};

type CurrencyRateEvidence =
  | (DirectRateEvidence & {
      source: 'domestic_credit_institution_sell';
      institutionAuthorisedForDomesticCurrencyExchange: boolean;
    })
  | (DirectRateEvidence & OfficialRateElectionEvidence & { source: 'mnb' })
  | (OfficialRateElectionEvidence & {
      source: 'ecb';
      hufUnitsPerEur: string;
      foreignCurrencyUnitsPerEur?: string | undefined;
      ratePublicationDate: string;
      latestValidRateConfirmed: boolean;
    })
  | {
      source: 'unquoted_currency_section_80_5';
      precedingQuarterEuroReferenceConfirmed: boolean;
    };

export type HungaryCurrencyConversionInput = {
  currency: string;
  amount: string;
  outputScale?: number | undefined;
  transaction: CurrencyTransaction;
  rate: CurrencyRateEvidence;
};

type DateResolution = {
  conversionDate: string;
  dateRule: 'tax_liability_determination_date' | 'invoice_issue_date' | 'performance_date';
  legalBasis: string;
};

function resolveConversionDate(transaction: CurrencyTransaction): DateResolution {
  if (transaction.kind === 'periodic_settlement_section_58') {
    assertIsoDate(transaction.invoiceIssueDate);
    return {
      conversionDate: transaction.invoiceIssueDate,
      dateRule: 'invoice_issue_date',
      legalBasis: 'Áfa tv. 80. § (1) b)'
    };
  }
  if (transaction.kind === 'other') {
    assertIsoDate(transaction.performanceDate);
    return {
      conversionDate: transaction.performanceDate,
      dateRule: 'performance_date',
      legalBasis: 'Áfa tv. 80. § (1) c)'
    };
  }

  assertIsoDate(transaction.taxLiabilityDeterminationDate);
  return {
    conversionDate: transaction.taxLiabilityDeterminationDate,
    dateRule: 'tax_liability_determination_date',
    legalBasis: 'Áfa tv. 80. § (1) a)'
  };
}

function validateScale(scale: number): void {
  if (!Number.isInteger(scale) || scale < 0 || scale > 6) {
    throw new Error('outputScale must be an integer between 0 and 6');
  }
}

function validateCurrency(currency: string): void {
  if (!/^[A-Z]{3}$/.test(currency) || currency === 'HUF') {
    throw new Error('currency must be a three-letter uppercase non-HUF currency code');
  }
}

function validatePublicationDate(ratePublicationDate: string, conversionDate: string): string | null {
  assertIsoDate(ratePublicationDate);
  return ratePublicationDate > conversionDate
    ? 'The supplied rate publication date is later than the statutory conversion date.'
    : null;
}

function electionEvidenceFailure(rate: OfficialRateElectionEvidence): string | null {
  if (!rate.electionDeclaredToNavBeforeUse) {
    return 'MNB/EKB use requires a prior declaration to NAV.';
  }
  if (!rate.electionAppliesToAllForeignCurrencyTransactions) {
    return 'The MNB/EKB election must cover every foreign-currency transaction within its statutory scope.';
  }
  if (!rate.electionLockInObserved) {
    return 'The caller has not confirmed observance of the statutory election lock-in period.';
  }
  if (!rate.exclusiveMnbOrEcbChoiceConfirmed) {
    return 'The caller has not confirmed that MNB and EKB rate choices are not used together.';
  }
  return null;
}

function directConversion(amount: string, quotedCurrencyUnits: string, hufAmount: string, outputScale: number): string {
  const parsedAmount = parseDecimal(amount, 'amount');
  const parsedQuoteUnits = parseDecimal(quotedCurrencyUnits, 'quotedCurrencyUnits');
  const parsedHuf = parseDecimal(hufAmount, 'hufAmount');
  if (parsedQuoteUnits.units <= 0n) throw new Error('quotedCurrencyUnits must be greater than zero');
  if (parsedHuf.units <= 0n) throw new Error('hufAmount must be greater than zero');

  const numerator = parsedAmount.units * parsedHuf.units * powerOfTen(parsedQuoteUnits.scale);
  const denominator = powerOfTen(parsedAmount.scale + parsedHuf.scale) * parsedQuoteUnits.units;
  return formatFixedScale(roundFractionToScale(numerator, denominator, outputScale), outputScale);
}

function ecbConversion(input: HungaryCurrencyConversionInput, outputScale: number): string {
  if (input.rate.source !== 'ecb') throw new Error('Internal EKB conversion mismatch');
  const currencyUnitsPerEur = input.currency === 'EUR' ? '1' : input.rate.foreignCurrencyUnitsPerEur;
  if (currencyUnitsPerEur === undefined) {
    throw new Error('foreignCurrencyUnitsPerEur is required for a non-EUR EKB conversion');
  }
  return directConversion(input.amount, currencyUnitsPerEur, input.rate.hufUnitsPerEur, outputScale);
}

function manualReview(
  input: HungaryCurrencyConversionInput,
  resolution: DateResolution,
  reason: string,
  sourceIds: string[]
) {
  return {
    rulesetId: HUNGARY_VAT_RULESET.id,
    status: 'manual_review' as const,
    currency: input.currency,
    inputAmount: input.amount,
    conversionDate: resolution.conversionDate,
    dateRule: resolution.dateRule,
    rateSource: input.rate.source,
    legalBasis: `${resolution.legalBasis}; Áfa tv. 80–80/A. §`,
    sourceIds,
    reason,
    notice: 'No HUF amount is emitted until the statutory date/source evidence is complete. Import conversion under §81 and modification/correction-specific exchange-rate treatment are outside this endpoint.'
  };
}

export function convertHungaryVatAmountToHuf(input: HungaryCurrencyConversionInput) {
  validateCurrency(input.currency);
  const outputScale = input.outputScale ?? 2;
  validateScale(outputScale);
  const resolution = resolveConversionDate(input.transaction);
  assertSupportedDate(resolution.conversionDate);
  parseDecimal(input.amount, 'amount');

  if (input.rate.source === 'unquoted_currency_section_80_5') {
    return manualReview(
      input,
      resolution,
      input.rate.precedingQuarterEuroReferenceConfirmed
        ? 'The §80 (5) quarterly euro-reference path is identified, but its two-stage rate adapter is not automated in this ruleset.'
        : 'The required preceding-calendar-quarter euro reference is not confirmed for this unquoted currency.',
      ['HU-AFA-TV']
    );
  }

  const publicationFailure = validatePublicationDate(input.rate.ratePublicationDate, resolution.conversionDate);
  if (publicationFailure) return manualReview(input, resolution, publicationFailure, ['HU-AFA-TV', 'NAV-INVOICE-RULES-2026']);
  if (!input.rate.latestValidRateConfirmed) {
    return manualReview(input, resolution, 'The caller has not confirmed that this was the latest valid rate at the statutory conversion date.', ['HU-AFA-TV', 'NAV-INVOICE-RULES-2026']);
  }

  if (input.rate.source === 'domestic_credit_institution_sell') {
    if (!input.rate.institutionAuthorisedForDomesticCurrencyExchange) {
      return manualReview(input, resolution, 'The domestic credit institution currency-exchange authorisation is not confirmed.', ['HU-AFA-TV', 'NAV-INVOICE-RULES-2026']);
    }
    return {
      rulesetId: HUNGARY_VAT_RULESET.id,
      status: 'converted' as const,
      currency: input.currency,
      inputAmount: input.amount,
      amountHuf: directConversion(input.amount, input.rate.quotedCurrencyUnits, input.rate.hufAmount, outputScale),
      outputScale,
      conversionDate: resolution.conversionDate,
      dateRule: resolution.dateRule,
      rateSource: input.rate.source,
      ratePublicationDate: input.rate.ratePublicationDate,
      legalBasis: `${resolution.legalBasis}; Áfa tv. 80. § (2) a)`,
      sourceIds: ['HU-AFA-TV', 'NAV-INVOICE-RULES-2026'],
      rounding: 'half_away_from_zero_at_requested_scale',
      notice: 'The caller supplies and confirms the documentary rate evidence. The selected output scale is a computational policy, not a universal statutory invoice-rounding rule.'
    };
  }

  const electionFailure = electionEvidenceFailure(input.rate);
  if (electionFailure) return manualReview(input, resolution, electionFailure, ['HU-AFA-TV', 'NAV-INVOICE-RULES-2026']);

  const amountHuf = input.rate.source === 'mnb'
    ? directConversion(input.amount, input.rate.quotedCurrencyUnits, input.rate.hufAmount, outputScale)
    : ecbConversion(input, outputScale);

  return {
    rulesetId: HUNGARY_VAT_RULESET.id,
    status: 'converted' as const,
    currency: input.currency,
    inputAmount: input.amount,
    amountHuf,
    outputScale,
    conversionDate: resolution.conversionDate,
    dateRule: resolution.dateRule,
    rateSource: input.rate.source,
    ratePublicationDate: input.rate.ratePublicationDate,
    legalBasis: `${resolution.legalBasis}; ${input.rate.source === 'mnb' ? 'Áfa tv. 80. § (2) b)–(4)' : 'Áfa tv. 80/A. §'}`,
    sourceIds: ['HU-AFA-TV', 'NAV-INVOICE-RULES-2026'],
    rounding: 'half_away_from_zero_at_requested_scale',
    notice: 'The caller supplies and confirms the official rate/election evidence. MNB and EKB are mutually exclusive choices; the selected output scale is a computational policy.'
  };
}
