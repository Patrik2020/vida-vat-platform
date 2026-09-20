import type { DecimalString } from './types.js';

const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

type Decimal = { coefficient: bigint; scale: number };

export function isDecimalString(value: unknown): value is DecimalString {
  return typeof value === 'string' && DECIMAL_PATTERN.test(value);
}

function parseDecimal(value: DecimalString): Decimal {
  if (!isDecimalString(value)) throw new Error(`Invalid decimal: ${value}`);
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [integer = '0', fraction = ''] = unsigned.split('.');
  return {
    coefficient: BigInt(`${negative ? '-' : ''}${integer}${fraction}`),
    scale: fraction.length,
  };
}

function powerOfTen(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

function align(left: Decimal, right: Decimal): [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.coefficient * powerOfTen(scale - left.scale),
    right.coefficient * powerOfTen(scale - right.scale),
    scale,
  ];
}

function normalize(value: Decimal): Decimal {
  let { coefficient, scale } = value;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  return { coefficient, scale };
}

function stringifyDecimal(value: Decimal): DecimalString {
  const normalized = normalize(value);
  const negative = normalized.coefficient < 0n;
  const digits = (negative ? -normalized.coefficient : normalized.coefficient).toString();
  if (normalized.scale === 0) return `${negative ? '-' : ''}${digits}`;
  const padded = digits.padStart(normalized.scale + 1, '0');
  const split = padded.length - normalized.scale;
  return `${negative ? '-' : ''}${padded.slice(0, split)}.${padded.slice(split)}`;
}

export function addDecimals(...values: DecimalString[]): DecimalString {
  let total: Decimal = { coefficient: 0n, scale: 0 };
  for (const value of values) {
    const parsed = parseDecimal(value);
    const [left, right, scale] = align(total, parsed);
    total = { coefficient: left + right, scale };
  }
  return stringifyDecimal(total);
}

export function subtractDecimals(left: DecimalString, right: DecimalString): DecimalString {
  const [leftCoefficient, rightCoefficient, scale] = align(parseDecimal(left), parseDecimal(right));
  return stringifyDecimal({ coefficient: leftCoefficient - rightCoefficient, scale });
}

export function decimalsEqual(left: DecimalString, right: DecimalString): boolean {
  const [leftCoefficient, rightCoefficient] = align(parseDecimal(left), parseDecimal(right));
  return leftCoefficient === rightCoefficient;
}
