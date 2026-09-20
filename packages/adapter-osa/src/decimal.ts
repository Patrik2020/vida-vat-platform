const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

type Decimal = { coefficient: bigint; scale: number };

export function isDecimal(value: unknown): value is string {
  return typeof value === 'string' && DECIMAL_PATTERN.test(value);
}

function parse(value: string): Decimal {
  if (!isDecimal(value)) throw new Error(`Invalid decimal: ${value}`);
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [integer = '0', fraction = ''] = unsigned.split('.');
  return { coefficient: BigInt(`${negative ? '-' : ''}${integer}${fraction}`), scale: fraction.length };
}

function stringify(value: Decimal): string {
  let { coefficient, scale } = value;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  const negative = coefficient < 0n;
  const digits = (negative ? -coefficient : coefficient).toString().padStart(scale + 1, '0');
  if (scale === 0) return `${negative ? '-' : ''}${digits}`;
  const split = digits.length - scale;
  return `${negative ? '-' : ''}${digits.slice(0, split)}.${digits.slice(split)}`;
}

export function add(left: string, right: string): string {
  const a = parse(left);
  const b = parse(right);
  const scale = Math.max(a.scale, b.scale);
  const coefficient = a.coefficient * 10n ** BigInt(scale - a.scale) + b.coefficient * 10n ** BigInt(scale - b.scale);
  return stringify({ coefficient, scale });
}

export function fractionToPercent(value: string): string {
  const parsed = parse(value);
  return stringify({ coefficient: parsed.coefficient * 100n, scale: parsed.scale });
}
