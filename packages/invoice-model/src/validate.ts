import { addDecimals, decimalsEqual, isDecimalString, subtractDecimals } from './decimal.js';
import {
  CANONICAL_INVOICE_SCHEMA,
  CANONICAL_INVOICE_SCHEMA_VERSION,
  type CanonicalInvoice,
  type CanonicalInvoiceValidationResult,
  type Money,
  type TaxCategory,
  type ValidationIssue,
} from './types.js';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_CURRENCY_PATTERN = /^[A-Z]{3}$/;
const ISO_COUNTRY_PATTERN = /^[A-Z]{2}$/;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const TAXABLE_CATEGORIES = new Set(['S', 'Z', 'L', 'M']);
const EXEMPT_CATEGORIES = new Set(['E', 'AE', 'K', 'G', 'O']);

function pushError(issues: ValidationIssue[], code: string, path: string, message: string): void {
  issues.push({ severity: 'error', code, path, message });
}

function pushWarning(issues: ValidationIssue[], code: string, path: string, message: string): void {
  issues.push({ severity: 'warning', code, path, message });
}

function validateMoney(issues: ValidationIssue[], money: Money, path: string, currency: string): void {
  if (!isDecimalString(money.amount)) pushError(issues, 'INVALID_DECIMAL', `${path}.amount`, 'Amount must be a canonical decimal string.');
  if (money.currency !== currency) pushError(issues, 'CURRENCY_MISMATCH', `${path}.currency`, `Expected invoice currency ${currency}.`);
}

function validateTaxCategory(issues: ValidationIssue[], category: TaxCategory, path: string): void {
  if (TAXABLE_CATEGORIES.has(category.code) && !isDecimalString(category.rate)) {
    pushError(issues, 'MISSING_TAX_RATE', `${path}.rate`, `Tax category ${category.code} requires a rate.`);
  }
  if (EXEMPT_CATEGORIES.has(category.code) && !category.exemptionReason && !category.exemptionReasonCode) {
    pushError(issues, 'MISSING_EXEMPTION_REASON', path, `Tax category ${category.code} requires an exemption reason or code.`);
  }
}

function moneyAmounts(items: Money[]): string[] {
  return items.map((item) => item.amount);
}

export function validateCanonicalInvoice(invoice: CanonicalInvoice): CanonicalInvoiceValidationResult {
  const issues: ValidationIssue[] = [];
  const currency = invoice.document.currency;

  if (invoice.schema !== CANONICAL_INVOICE_SCHEMA) pushError(issues, 'UNSUPPORTED_SCHEMA', 'schema', 'Unsupported canonical invoice schema.');
  if (invoice.schemaVersion !== CANONICAL_INVOICE_SCHEMA_VERSION) pushError(issues, 'UNSUPPORTED_SCHEMA_VERSION', 'schemaVersion', 'Unsupported canonical invoice schema version.');
  if (invoice.semanticModel.standard !== 'EN16931' || invoice.semanticModel.edition !== '2026') {
    pushError(issues, 'UNSUPPORTED_SEMANTIC_MODEL', 'semanticModel', 'Expected EN 16931:2026 semantic model.');
  }
  if (!invoice.document.id.trim()) pushError(issues, 'MISSING_DOCUMENT_ID', 'document.id', 'Invoice identifier is required.');
  if (!ISO_DATE_PATTERN.test(invoice.document.issueDate)) pushError(issues, 'INVALID_DATE', 'document.issueDate', 'Use YYYY-MM-DD.');
  if (invoice.document.dueDate && !ISO_DATE_PATTERN.test(invoice.document.dueDate)) pushError(issues, 'INVALID_DATE', 'document.dueDate', 'Use YYYY-MM-DD.');
  if (invoice.document.taxPointDate && !ISO_DATE_PATTERN.test(invoice.document.taxPointDate)) pushError(issues, 'INVALID_DATE', 'document.taxPointDate', 'Use YYYY-MM-DD.');
  if (!ISO_CURRENCY_PATTERN.test(currency)) pushError(issues, 'INVALID_CURRENCY', 'document.currency', 'Use an ISO 4217 alpha-3 currency code.');
  if (!ISO_COUNTRY_PATTERN.test(invoice.seller.address.countryCode)) pushError(issues, 'INVALID_COUNTRY', 'seller.address.countryCode', 'Use an ISO 3166-1 alpha-2 country code.');
  if (!ISO_COUNTRY_PATTERN.test(invoice.buyer.address.countryCode)) pushError(issues, 'INVALID_COUNTRY', 'buyer.address.countryCode', 'Use an ISO 3166-1 alpha-2 country code.');
  if (!invoice.seller.name.trim()) pushError(issues, 'MISSING_PARTY_NAME', 'seller.name', 'Seller name is required.');
  if (!invoice.buyer.name.trim()) pushError(issues, 'MISSING_PARTY_NAME', 'buyer.name', 'Buyer name is required.');
  if (invoice.lines.length === 0) pushError(issues, 'MISSING_INVOICE_LINES', 'lines', 'At least one invoice line is required.');
  if (!UTC_TIMESTAMP_PATTERN.test(invoice.provenance.transformedAt)) pushError(issues, 'INVALID_TIMESTAMP', 'provenance.transformedAt', 'Use a UTC ISO 8601 timestamp ending in Z.');
  if (!invoice.provenance.adapterVersion.trim()) pushError(issues, 'MISSING_ADAPTER_VERSION', 'provenance.adapterVersion', 'Adapter version is required for reproducibility.');

  const lineIds = new Set<string>();
  invoice.lines.forEach((line, index) => {
    const path = `lines[${index}]`;
    if (!line.id.trim()) pushError(issues, 'MISSING_LINE_ID', `${path}.id`, 'Line identifier is required.');
    if (lineIds.has(line.id)) pushError(issues, 'DUPLICATE_LINE_ID', `${path}.id`, `Duplicate line identifier ${line.id}.`);
    lineIds.add(line.id);
    if (!line.item.name.trim()) pushError(issues, 'MISSING_ITEM_NAME', `${path}.item.name`, 'Item name is required.');
    if (!isDecimalString(line.quantity.value)) pushError(issues, 'INVALID_DECIMAL', `${path}.quantity.value`, 'Quantity must be a canonical decimal string.');
    if (!line.quantity.unitCode.trim()) pushError(issues, 'MISSING_UNIT_CODE', `${path}.quantity.unitCode`, 'Unit code is required.');
    validateMoney(issues, line.netPrice.amount, `${path}.netPrice.amount`, currency);
    if (line.netPrice.baseQuantity !== undefined && !isDecimalString(line.netPrice.baseQuantity)) pushError(issues, 'INVALID_DECIMAL', `${path}.netPrice.baseQuantity`, 'Base quantity must be a canonical decimal string.');
    validateMoney(issues, line.netAmount, `${path}.netAmount`, currency);
    validateTaxCategory(issues, line.taxCategory, `${path}.taxCategory`);
    line.allowancesAndCharges?.forEach((entry, entryIndex) => validateMoney(issues, entry.amount, `${path}.allowancesAndCharges[${entryIndex}].amount`, currency));
  });

  invoice.documentAllowancesAndCharges?.forEach((entry, index) => validateMoney(issues, entry.amount, `documentAllowancesAndCharges[${index}].amount`, currency));
  invoice.taxBreakdowns.forEach((breakdown, index) => {
    validateTaxCategory(issues, breakdown.category, `taxBreakdowns[${index}].category`);
    validateMoney(issues, breakdown.taxableAmount, `taxBreakdowns[${index}].taxableAmount`, currency);
    validateMoney(issues, breakdown.taxAmount, `taxBreakdowns[${index}].taxAmount`, currency);
  });
  for (const [name, value] of Object.entries(invoice.totals)) {
    if (value) validateMoney(issues, value, `totals.${name}`, currency);
  }

  if (issues.some((issue) => issue.code === 'INVALID_DECIMAL' || issue.code === 'CURRENCY_MISMATCH')) {
    return { valid: false, issues };
  }

  const expectedLineNet = addDecimals(...moneyAmounts(invoice.lines.map((line) => line.netAmount)));
  if (!decimalsEqual(expectedLineNet, invoice.totals.lineNetAmount.amount)) {
    pushError(issues, 'LINE_NET_TOTAL_MISMATCH', 'totals.lineNetAmount.amount', `Expected ${expectedLineNet} from invoice lines.`);
  }

  const documentAllowances = invoice.documentAllowancesAndCharges?.filter((entry) => entry.kind === 'allowance').map((entry) => entry.amount.amount) ?? [];
  const documentCharges = invoice.documentAllowancesAndCharges?.filter((entry) => entry.kind === 'charge').map((entry) => entry.amount.amount) ?? [];
  const expectedAllowanceTotal = addDecimals(...documentAllowances);
  const expectedChargeTotal = addDecimals(...documentCharges);
  const declaredAllowanceTotal = invoice.totals.allowanceTotalAmount?.amount ?? '0';
  const declaredChargeTotal = invoice.totals.chargeTotalAmount?.amount ?? '0';
  if (!decimalsEqual(expectedAllowanceTotal, declaredAllowanceTotal)) pushError(issues, 'ALLOWANCE_TOTAL_MISMATCH', 'totals.allowanceTotalAmount.amount', `Expected ${expectedAllowanceTotal}.`);
  if (!decimalsEqual(expectedChargeTotal, declaredChargeTotal)) pushError(issues, 'CHARGE_TOTAL_MISMATCH', 'totals.chargeTotalAmount.amount', `Expected ${expectedChargeTotal}.`);

  const expectedTaxExclusive = addDecimals(subtractDecimals(expectedLineNet, declaredAllowanceTotal), declaredChargeTotal);
  if (!decimalsEqual(expectedTaxExclusive, invoice.totals.taxExclusiveAmount.amount)) pushError(issues, 'TAX_EXCLUSIVE_TOTAL_MISMATCH', 'totals.taxExclusiveAmount.amount', `Expected ${expectedTaxExclusive}.`);

  const expectedTaxTotal = addDecimals(...moneyAmounts(invoice.taxBreakdowns.map((breakdown) => breakdown.taxAmount)));
  if (!decimalsEqual(expectedTaxTotal, invoice.totals.taxTotalAmount.amount)) pushError(issues, 'TAX_TOTAL_MISMATCH', 'totals.taxTotalAmount.amount', `Expected ${expectedTaxTotal} from tax breakdowns.`);

  const expectedTaxInclusive = addDecimals(invoice.totals.taxExclusiveAmount.amount, invoice.totals.taxTotalAmount.amount);
  if (!decimalsEqual(expectedTaxInclusive, invoice.totals.taxInclusiveAmount.amount)) pushError(issues, 'TAX_INCLUSIVE_TOTAL_MISMATCH', 'totals.taxInclusiveAmount.amount', `Expected ${expectedTaxInclusive}.`);

  const expectedAmountDue = addDecimals(
    subtractDecimals(invoice.totals.taxInclusiveAmount.amount, invoice.totals.prepaidAmount?.amount ?? '0'),
    invoice.totals.payableRoundingAmount?.amount ?? '0',
  );
  if (!decimalsEqual(expectedAmountDue, invoice.totals.amountDue.amount)) pushError(issues, 'AMOUNT_DUE_MISMATCH', 'totals.amountDue.amount', `Expected ${expectedAmountDue}.`);

  if (!invoice.provenance.contentHash) pushWarning(issues, 'MISSING_CONTENT_HASH', 'provenance.contentHash', 'A source content hash is recommended for audit evidence.');
  return { valid: !issues.some((issue) => issue.severity === 'error'), issues };
}
