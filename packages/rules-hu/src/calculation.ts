import { HUNGARY_VAT_RULESET, assertSupportedDate } from './rates.js';
import type { HungaryVatRate } from './types.js';

export type VatCalculationInput = {
  effectiveDate: string;
  amount: string;
  amountType: 'net' | 'gross';
  treatment: 'taxable' | 'exempt' | 'reverse_charge';
  rate?: HungaryVatRate | undefined;
  scale?: number | undefined;
};

function parseMinorUnits(value: string, scale: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error('amount must be a non-negative decimal string');
  }
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > scale) {
    throw new Error(`amount has more than ${scale} decimal places`);
  }
  return BigInt(whole + fraction.padEnd(scale, '0'));
}

function formatMinorUnits(value: bigint, scale: number): string {
  const raw = value.toString().padStart(scale + 1, '0');
  if (scale === 0) return raw;
  return `${raw.slice(0, -scale)}.${raw.slice(-scale)}`;
}

function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

export function calculateHungaryVat(input: VatCalculationInput) {
  assertSupportedDate(input.effectiveDate);
  const scale = input.scale ?? 2;
  if (!Number.isInteger(scale) || scale < 0 || scale > 6) {
    throw new Error('scale must be an integer between 0 and 6');
  }

  const amountMinor = parseMinorUnits(input.amount, scale);

  if (input.treatment !== 'taxable') {
    return {
      rulesetId: HUNGARY_VAT_RULESET.id,
      effectiveDate: input.effectiveDate,
      treatment: input.treatment,
      rate: null,
      netAmount: formatMinorUnits(amountMinor, scale),
      vatAmount: formatMinorUnits(0n, scale),
      grossAmount: formatMinorUnits(amountMinor, scale),
      scale,
      sellerChargesVat: false,
      recipientAccountingRequired: input.treatment === 'reverse_charge',
      rounding: 'half_up_at_requested_scale'
    };
  }

  if (input.rate === undefined || !([0, 5, 18, 27] as number[]).includes(input.rate)) {
    throw new Error('taxable treatment requires rate 0, 5, 18 or 27');
  }

  const rate = BigInt(input.rate);
  let netMinor: bigint;
  let vatMinor: bigint;
  let grossMinor: bigint;

  if (input.amountType === 'net') {
    netMinor = amountMinor;
    vatMinor = divideHalfUp(netMinor * rate, 100n);
    grossMinor = netMinor + vatMinor;
  } else {
    grossMinor = amountMinor;
    netMinor = divideHalfUp(grossMinor * 100n, 100n + rate);
    vatMinor = grossMinor - netMinor;
  }

  return {
    rulesetId: HUNGARY_VAT_RULESET.id,
    effectiveDate: input.effectiveDate,
    treatment: input.treatment,
    rate: input.rate,
    netAmount: formatMinorUnits(netMinor, scale),
    vatAmount: formatMinorUnits(vatMinor, scale),
    grossAmount: formatMinorUnits(grossMinor, scale),
    scale,
    sellerChargesVat: true,
    recipientAccountingRequired: false,
    rounding: 'half_up_at_requested_scale',
    notice: 'This endpoint performs single-amount arithmetic at the caller-selected scale. Use the invoice aggregation and currency-to-HUF endpoints when those explicit policy/evidence boundaries are required.'
  };
}
