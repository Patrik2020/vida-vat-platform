import { formatFixedScale, parseFixedScale, divideHalfAwayFromZero } from './decimal.js';
import { HUNGARY_VAT_RULESET, assertSupportedDate } from './rates.js';
import type { HungaryVatRate } from './types.js';

export type InvoiceRoundingPolicy = 'per_line' | 'per_vat_rate_summary';

export type HungaryInvoiceLineInput = {
  lineId: string;
  netAmount: string;
  treatment: 'taxable' | 'exempt' | 'reverse_charge';
  rate?: HungaryVatRate | undefined;
};

export type HungaryInvoiceAggregationInput = {
  effectiveDate: string;
  currency: string;
  scale?: number | undefined;
  roundingPolicy: InvoiceRoundingPolicy;
  lines: HungaryInvoiceLineInput[];
};

type WorkingLine = {
  lineId: string;
  treatment: HungaryInvoiceLineInput['treatment'];
  rate: HungaryVatRate | null;
  netMinor: bigint;
  exactVatNumerator: bigint;
  exactVatDenominator: bigint;
  lineVatMinor: bigint;
};

type WorkingSummary = {
  treatment: HungaryInvoiceLineInput['treatment'];
  rate: HungaryVatRate | null;
  netMinor: bigint;
  lineVatMinor: bigint;
};

function validateInput(input: HungaryInvoiceAggregationInput, scale: number): void {
  assertSupportedDate(input.effectiveDate);
  if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error('currency must be a three-letter uppercase currency code');
  if (!Number.isInteger(scale) || scale < 0 || scale > 6) throw new Error('scale must be an integer between 0 and 6');
  if (input.lines.length === 0 || input.lines.length > 500) throw new Error('lines must contain between 1 and 500 entries');
  const ids = new Set<string>();
  for (const line of input.lines) {
    if (line.lineId.trim().length === 0) throw new Error('lineId must not be blank');
    if (ids.has(line.lineId)) throw new Error(`duplicate lineId: ${line.lineId}`);
    ids.add(line.lineId);
    if (line.treatment === 'taxable') {
      if (line.rate === undefined || !([0, 5, 18, 27] as number[]).includes(line.rate)) {
        throw new Error(`taxable line ${line.lineId} requires rate 0, 5, 18 or 27`);
      }
    } else if (line.rate !== undefined) {
      throw new Error(`non-taxable line ${line.lineId} must not declare a VAT rate`);
    }
  }
}

function groupKey(line: WorkingLine): string {
  return line.treatment === 'taxable' ? `taxable:${line.rate}` : line.treatment;
}

function selectedVat(policy: InvoiceRoundingPolicy, lineVatMinor: bigint, summaryVatMinor: bigint): bigint {
  return policy === 'per_line' ? lineVatMinor : summaryVatMinor;
}

export function aggregateHungaryVatInvoice(input: HungaryInvoiceAggregationInput) {
  const scale = input.scale ?? 2;
  validateInput(input, scale);

  const lines: WorkingLine[] = input.lines.map((line) => {
    const netMinor = parseFixedScale(line.netAmount, scale, `netAmount for line ${line.lineId}`, true);
    const rate = line.treatment === 'taxable' ? (line.rate as HungaryVatRate) : null;
    const exactVatNumerator = rate === null ? 0n : netMinor * BigInt(rate);
    const exactVatDenominator = rate === null ? 1n : 100n;
    return {
      lineId: line.lineId,
      treatment: line.treatment,
      rate,
      netMinor,
      exactVatNumerator,
      exactVatDenominator,
      lineVatMinor: divideHalfAwayFromZero(exactVatNumerator, exactVatDenominator)
    };
  });

  const groups = new Map<string, WorkingSummary>();
  for (const line of lines) {
    const key = groupKey(line);
    const current = groups.get(key) ?? { treatment: line.treatment, rate: line.rate, netMinor: 0n, lineVatMinor: 0n };
    current.netMinor += line.netMinor;
    current.lineVatMinor += line.lineVatMinor;
    groups.set(key, current);
  }

  let invoiceNetMinor = 0n;
  let invoiceLineVatMinor = 0n;
  let invoiceSummaryVatMinor = 0n;

  const summaries = [...groups.values()].map((group) => {
    const summaryVatMinor = group.rate === null
      ? 0n
      : divideHalfAwayFromZero(group.netMinor * BigInt(group.rate), 100n);
    const chosenVatMinor = selectedVat(input.roundingPolicy, group.lineVatMinor, summaryVatMinor);
    invoiceNetMinor += group.netMinor;
    invoiceLineVatMinor += group.lineVatMinor;
    invoiceSummaryVatMinor += summaryVatMinor;
    return {
      treatment: group.treatment,
      rate: group.rate,
      netAmount: formatFixedScale(group.netMinor, scale),
      lineRoundedVatAmount: formatFixedScale(group.lineVatMinor, scale),
      rateSummaryRoundedVatAmount: formatFixedScale(summaryVatMinor, scale),
      roundingDifference: formatFixedScale(summaryVatMinor - group.lineVatMinor, scale),
      selectedVatAmount: formatFixedScale(chosenVatMinor, scale),
      selectedGrossAmount: formatFixedScale(group.netMinor + chosenVatMinor, scale)
    };
  });

  const invoiceSelectedVatMinor = selectedVat(input.roundingPolicy, invoiceLineVatMinor, invoiceSummaryVatMinor);
  const zero = formatFixedScale(0n, scale);
  const groupsWithDifference = summaries
    .filter((summary) => summary.roundingDifference !== zero)
    .map((summary) => ({ treatment: summary.treatment, rate: summary.rate, roundingDifference: summary.roundingDifference }));

  return {
    rulesetId: HUNGARY_VAT_RULESET.id,
    effectiveDate: input.effectiveDate,
    currency: input.currency,
    scale,
    roundingPolicy: input.roundingPolicy,
    roundingMode: 'half_away_from_zero_at_requested_scale' as const,
    policyNature: 'caller_selected_computational_policy' as const,
    lines: lines.map((line) => ({
      lineId: line.lineId,
      treatment: line.treatment,
      rate: line.rate,
      netAmount: formatFixedScale(line.netMinor, scale),
      exactVatMinorUnits: {
        numerator: line.exactVatNumerator.toString(),
        denominator: line.exactVatDenominator.toString()
      },
      lineRoundedVatAmount: formatFixedScale(line.lineVatMinor, scale),
      lineRoundedGrossAmount: formatFixedScale(line.netMinor + line.lineVatMinor, scale)
    })),
    summaries,
    totals: {
      netAmount: formatFixedScale(invoiceNetMinor, scale),
      lineRoundedVatAmount: formatFixedScale(invoiceLineVatMinor, scale),
      rateSummaryRoundedVatAmount: formatFixedScale(invoiceSummaryVatMinor, scale),
      roundingDifference: formatFixedScale(invoiceSummaryVatMinor - invoiceLineVatMinor, scale),
      selectedVatAmount: formatFixedScale(invoiceSelectedVatMinor, scale),
      selectedGrossAmount: formatFixedScale(invoiceNetMinor + invoiceSelectedVatMinor, scale)
    },
    reconciliation: {
      differenceDetected: groupsWithDifference.length > 0,
      groupsWithDifference,
      allocationRequiredForLineReconciliation: input.roundingPolicy === 'per_vat_rate_summary' && groupsWithDifference.length > 0,
      selectedPolicyReconcilesTo: input.roundingPolicy === 'per_line' ? 'sum_of_line_rounded_vat' : 'sum_of_rate_summary_rounded_vat'
    },
    legalBasis: 'Áfa tv. 169. § j)–k), 171–172. §; no universal statutory line-versus-summary rounding method is inferred',
    sourceIds: ['HU-AFA-TV', 'NAV-INVOICE-RULES-2026'],
    notice: 'This endpoint makes the rounding boundary explicit and auditable. The caller-selected policy must be validated against the invoicing/accounting context and current reporting specification.'
  };
}
