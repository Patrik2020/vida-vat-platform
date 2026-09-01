const MAX_DECIMAL_DIGITS = 36;
const MAX_DECIMAL_SCALE = 18;

export type ParsedDecimal = {
  units: bigint;
  scale: number;
};

export function powerOfTen(exponent: number): bigint {
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > MAX_DECIMAL_SCALE * 3) {
    throw new Error(`decimal exponent must be an integer between 0 and ${MAX_DECIMAL_SCALE * 3}`);
  }
  return 10n ** BigInt(exponent);
}

export function parseDecimal(value: string, label: string, allowNegative = false): ParsedDecimal {
  const pattern = allowNegative ? /^-?\d+(?:\.\d+)?$/ : /^\d+(?:\.\d+)?$/;
  if (!pattern.test(value)) {
    throw new Error(`${label} must be ${allowNegative ? 'a' : 'a non-negative'} decimal string`);
  }

  const unsigned = value.startsWith('-') ? value.slice(1) : value;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  if (whole.length + fraction.length > MAX_DECIMAL_DIGITS) {
    throw new Error(`${label} must contain at most ${MAX_DECIMAL_DIGITS} digits`);
  }
  if (fraction.length > MAX_DECIMAL_SCALE) {
    throw new Error(`${label} must contain at most ${MAX_DECIMAL_SCALE} decimal places`);
  }

  const magnitude = BigInt(`${whole}${fraction}`);
  return {
    units: value.startsWith('-') ? -magnitude : magnitude,
    scale: fraction.length
  };
}

export function parseFixedScale(value: string, scale: number, label: string, allowNegative = false): bigint {
  const parsed = parseDecimal(value, label, allowNegative);
  if (parsed.scale > scale) {
    throw new Error(`${label} has more than ${scale} decimal places`);
  }
  return parsed.units * powerOfTen(scale - parsed.scale);
}

export function formatFixedScale(value: bigint, scale: number): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const raw = absolute.toString().padStart(scale + 1, '0');
  const formatted = scale === 0 ? raw : `${raw.slice(0, -scale)}.${raw.slice(-scale)}`;
  return negative && absolute !== 0n ? `-${formatted}` : formatted;
}

export function divideHalfAwayFromZero(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error('decimal denominator must be positive');
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

export function roundFractionToScale(numerator: bigint, denominator: bigint, scale: number): bigint {
  return divideHalfAwayFromZero(numerator * powerOfTen(scale), denominator);
}
