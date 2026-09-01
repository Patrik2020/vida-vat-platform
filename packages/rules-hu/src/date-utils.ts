const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function assertIsoDate(value: string): void {
  if (!ISO_DATE.test(value)) {
    throw new Error(`Invalid ISO date: ${value}. Expected YYYY-MM-DD.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid calendar date: ${value}.`);
  }
}

export function addDays(value: string, days: number): string {
  assertIsoDate(value);
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addCalendarYears(value: string, years: number): string {
  assertIsoDate(value);
  if (!Number.isInteger(years)) {
    throw new Error(`Calendar years must be an integer: ${years}.`);
  }

  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const targetYear = year + years;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);

  return `${String(targetYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}
