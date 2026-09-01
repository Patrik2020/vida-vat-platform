import { addDays, assertIsoDate } from './date-utils.js';
import { assertSupportedDate } from './rates.js';

export type PeriodicTaxPointInput = {
  periodEnd: string;
  invoiceDate: string;
  dueDate: string;
};

export function resolvePeriodicTaxPoint(input: PeriodicTaxPointInput) {
  assertIsoDate(input.periodEnd);
  assertIsoDate(input.invoiceDate);
  assertIsoDate(input.dueDate);

  let taxPoint: string;
  let rule: string;

  if (input.invoiceDate < input.periodEnd && input.dueDate < input.periodEnd) {
    taxPoint = input.invoiceDate;
    rule = 'invoice_before_period_end_and_due_before_period_end';
  } else if (input.dueDate > input.periodEnd) {
    const cap = addDays(input.periodEnd, 60);
    taxPoint = input.dueDate < cap ? input.dueDate : cap;
    rule = input.dueDate < cap ? 'due_after_period_end' : 'sixty_day_cap';
  } else {
    taxPoint = input.periodEnd;
    rule = 'period_end';
  }

  assertSupportedDate(taxPoint);

  return {
    rulesetId: 'HU-VAT-2026-002',
    taxPoint,
    rule,
    legalBasis: 'Áfa tv. 58. § (1) és (1a)',
    sourceIds: ['HU-AFA-TV', 'NAV-PERIODIC-TAX-POINT']
  };
}
