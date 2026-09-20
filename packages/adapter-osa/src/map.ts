import { createHash } from 'node:crypto';
import {
  CANONICAL_INVOICE_SCHEMA,
  CANONICAL_INVOICE_SCHEMA_VERSION,
  validateCanonicalInvoice,
  type Address,
  type CanonicalInvoice,
  type Identifier,
  type Party,
  type TaxCategory,
} from '@vida/invoice-model';
import { add, fractionToPercent, isDecimal } from './decimal.js';
import {
  OSA_ADAPTER_VERSION,
  OSA_OFFICIAL_INVOICE_DATA_XSD,
  OSA_SCHEMA_VERSION,
} from './source.js';
import type { OsaAdapterIssue, OsaAdapterOptions, OsaAdapterResult, OsaMappingEvidence } from './types.js';
import { asArray, asRecord, parseOsaInvoiceDataXml, text, type XmlRecord } from './xml.js';

const UNIT_CODES: Record<string, string> = {
  PIECE: 'C62', KILOGRAM: 'KGM', TON: 'TNE', KWH: 'KWH', DAY: 'DAY', HOUR: 'HUR',
  MINUTE: 'MIN', MONTH: 'MON', LITER: 'LTR', KILOMETER: 'KMT', CUBIC_METER: 'MTQ',
  METER: 'MTR', LINEAR_METER: 'MTR', CARTON: 'CT', PACK: 'PK',
};

type MappingContext = { issues: OsaAdapterIssue[]; evidence: OsaMappingEvidence[] };

function error(ctx: MappingContext, code: string, message: string, sourcePath?: string, targetPath?: string): void {
  ctx.issues.push({ severity: 'error', code, message, ...(sourcePath ? { sourcePath } : {}), ...(targetPath ? { targetPath } : {}) });
}

function evidence(ctx: MappingContext, sourcePath: string, targetPath: string, transformation: OsaMappingEvidence['transformation'], sourceValue?: string): void {
  ctx.evidence.push({ sourcePath, targetPath, transformation, ...(sourceValue !== undefined ? { sourceValue } : {}) });
}

function requiredString(ctx: MappingContext, parent: XmlRecord | undefined, key: string, sourcePath: string, targetPath: string): string {
  const value = text(parent?.[key]);
  if (!value?.trim()) {
    error(ctx, 'MISSING_REQUIRED_SOURCE_FIELD', `Missing required OSA field ${sourcePath}.`, sourcePath, targetPath);
    return '';
  }
  evidence(ctx, sourcePath, targetPath, 'direct', value);
  return value;
}

function taxNumberIdentifier(value: unknown): Identifier | undefined {
  const tax = asRecord(value);
  const taxpayerId = text(tax?.taxpayerId);
  if (!taxpayerId) return undefined;
  const vatCode = text(tax?.vatCode);
  const countyCode = text(tax?.countyCode);
  return { value: vatCode && countyCode ? `${taxpayerId}-${vatCode}-${countyCode}` : taxpayerId, schemeId: 'HU_TAX_NUMBER' };
}

function vatIdentifiers(value: unknown, communityVatNumber: unknown): Identifier[] | undefined {
  const result: Identifier[] = [];
  const tax = asRecord(value);
  const taxpayerId = text(tax?.taxpayerId);
  if (taxpayerId) result.push({ value: `HU${taxpayerId}`, schemeId: 'VAT' });
  const community = text(communityVatNumber);
  if (community) result.push({ value: community, schemeId: 'VAT' });
  return result.length ? result : undefined;
}

function mapAddress(ctx: MappingContext, value: unknown, sourcePath: string, targetPath: string): Address {
  const wrapper = asRecord(value);
  const simple = asRecord(wrapper?.simpleAddress);
  const detailed = asRecord(wrapper?.detailedAddress);
  const source = detailed ?? simple;
  if (!source) {
    error(ctx, 'MISSING_ADDRESS', `Missing supported address at ${sourcePath}.`, sourcePath, targetPath);
    return { countryCode: '' };
  }
  const countryCode = requiredString(ctx, source, 'countryCode', `${sourcePath}.${detailed ? 'detailedAddress' : 'simpleAddress'}.countryCode`, `${targetPath}.countryCode`);
  const result: Address = { countryCode };
  const postalCode = text(source.postalCode);
  const city = text(source.city);
  const region = text(source.region);
  if (postalCode) result.postalCode = postalCode;
  if (city) result.city = city;
  if (region) result.subdivision = region;
  if (detailed) {
    const line1 = [text(detailed.streetName), text(detailed.publicPlaceCategory), text(detailed.number)].filter(Boolean).join(' ');
    const line2 = [text(detailed.building), text(detailed.staircase), text(detailed.floor), text(detailed.door), text(detailed.lotNumber)].filter(Boolean).join(' ');
    if (line1) result.line1 = line1;
    if (line2) result.line2 = line2;
    evidence(ctx, `${sourcePath}.detailedAddress`, targetPath, 'derived');
  } else {
    const line1 = text(simple?.additionalAddressDetail);
    if (line1) result.line1 = line1;
    evidence(ctx, `${sourcePath}.simpleAddress`, targetPath, 'direct');
  }
  return result;
}

function mapSupplier(ctx: MappingContext, supplier: XmlRecord | undefined): Party {
  const name = requiredString(ctx, supplier, 'supplierName', 'InvoiceData.invoiceMain.invoice.invoiceHead.supplierInfo.supplierName', 'seller.name');
  const domestic = taxNumberIdentifier(supplier?.supplierTaxNumber);
  const vatIds = vatIdentifiers(supplier?.supplierTaxNumber, supplier?.communityVatNumber);
  return {
    name,
    ...(domestic ? { identifiers: [domestic] } : {}),
    ...(vatIds ? { vatIdentifiers: vatIds } : {}),
    address: mapAddress(ctx, supplier?.supplierAddress, 'InvoiceData.invoiceMain.invoice.invoiceHead.supplierInfo.supplierAddress', 'seller.address'),
  };
}

function mapCustomer(ctx: MappingContext, customer: XmlRecord | undefined): Party {
  const status = text(customer?.customerVatStatus);
  if (status === 'PRIVATE_PERSON') error(ctx, 'PRIVATE_PERSON_DATA_NOT_AVAILABLE', 'OSA reporting intentionally omits private-person buyer data required by the canonical invoice.', 'InvoiceData.invoiceMain.invoice.invoiceHead.customerInfo.customerVatStatus', 'buyer');
  const name = requiredString(ctx, customer, 'customerName', 'InvoiceData.invoiceMain.invoice.invoiceHead.customerInfo.customerName', 'buyer.name');
  const vatData = asRecord(customer?.customerVatData);
  const domestic = taxNumberIdentifier(vatData?.customerTaxNumber);
  const thirdState = text(vatData?.thirdStateTaxId);
  const identifiers = [domestic, thirdState ? { value: thirdState, schemeId: 'THIRD_STATE_TAX_ID' } : undefined].filter((item): item is Identifier => Boolean(item));
  const vatIds = vatIdentifiers(vatData?.customerTaxNumber, vatData?.communityVatNumber);
  return {
    name,
    ...(identifiers.length ? { identifiers } : {}),
    ...(vatIds ? { vatIdentifiers: vatIds } : {}),
    address: mapAddress(ctx, customer?.customerAddress, 'InvoiceData.invoiceMain.invoice.invoiceHead.customerInfo.customerAddress', 'buyer.address'),
  };
}

function mapTaxCategory(ctx: MappingContext, value: unknown, sourcePath: string, targetPath: string): TaxCategory {
  const vatRate = asRecord(value);
  const percentage = text(vatRate?.vatPercentage);
  if (percentage !== undefined) {
    if (!isDecimal(percentage)) {
      error(ctx, 'INVALID_VAT_PERCENTAGE', `Invalid OSA VAT percentage ${percentage}.`, `${sourcePath}.vatPercentage`, `${targetPath}.rate`);
      return { code: 'S' };
    }
    const rate = fractionToPercent(percentage);
    evidence(ctx, `${sourcePath}.vatPercentage`, `${targetPath}.rate`, 'fraction_to_percent', percentage);
    return { code: rate === '0' ? 'Z' : 'S', rate };
  }
  const exemption = asRecord(vatRate?.vatExemption);
  if (exemption) {
    const reason = text(exemption.reason);
    const code = text(exemption.case);
    evidence(ctx, `${sourcePath}.vatExemption`, targetPath, 'code_map');
    return { code: 'E', ...(reason ? { exemptionReason: reason } : {}), ...(code ? { exemptionReasonCode: code } : {}) };
  }
  const outOfScope = asRecord(vatRate?.vatOutOfScope);
  if (outOfScope) {
    const reason = text(outOfScope.reason);
    const code = text(outOfScope.case);
    evidence(ctx, `${sourcePath}.vatOutOfScope`, targetPath, 'code_map');
    return { code: 'O', ...(reason ? { exemptionReason: reason } : {}), ...(code ? { exemptionReasonCode: code } : {}) };
  }
  if (text(vatRate?.vatDomesticReverseCharge) === 'true') {
    evidence(ctx, `${sourcePath}.vatDomesticReverseCharge`, targetPath, 'code_map', 'true');
    return { code: 'AE', exemptionReason: 'Belföldi fordított adózás', exemptionReasonCode: 'DOMESTIC_REVERSE_CHARGE' };
  }
  error(ctx, 'UNSUPPORTED_VAT_CATEGORY', 'OSA VAT category cannot be mapped without semantic guessing.', sourcePath, targetPath);
  return { code: 'O', exemptionReason: 'Unsupported OSA VAT category', exemptionReasonCode: 'MANUAL_REVIEW' };
}

function unitCode(ctx: MappingContext, line: XmlRecord, sourcePath: string, targetPath: string): string {
  const unit = text(line.unitOfMeasure);
  if (!unit) {
    error(ctx, 'MISSING_UNIT', 'Canonical invoice line requires a unit code.', `${sourcePath}.unitOfMeasure`, targetPath);
    return '';
  }
  if (unit === 'OWN') {
    error(ctx, 'UNSUPPORTED_OWN_UNIT', `OSA own unit '${text(line.unitOfMeasureOwn) ?? ''}' needs a reviewed UNECE mapping.`, `${sourcePath}.unitOfMeasureOwn`, targetPath);
    return '';
  }
  const mapped = UNIT_CODES[unit];
  if (!mapped) {
    error(ctx, 'UNSUPPORTED_UNIT', `Unsupported OSA unit ${unit}.`, `${sourcePath}.unitOfMeasure`, targetPath);
    return '';
  }
  evidence(ctx, `${sourcePath}.unitOfMeasure`, targetPath, 'code_map', unit);
  return mapped;
}

export function mapOsaInvoiceDataXml(xml: string, options: OsaAdapterOptions): OsaAdapterResult {
  const ctx: MappingContext = { issues: [], evidence: [] };
  const parsed = parseOsaInvoiceDataXml(xml);
  ctx.issues.push(...parsed.issues);
  const root = parsed.root;
  if (!root) return manualReview(ctx);

  if (text(root.completenessIndicator) !== 'true') error(ctx, 'INCOMPLETE_SOURCE_DOCUMENT', 'OSA completenessIndicator is not true; the report cannot be treated as the full legal invoice.', 'InvoiceData.completenessIndicator');
  if (!options.amountDue || !isDecimal(options.amountDue)) error(ctx, 'MISSING_AMOUNT_DUE_EVIDENCE', 'OSA 3.0 has no EN 16931 BT-115 equivalent; provide an evidence-backed amountDue.', undefined, 'totals.amountDue.amount');

  const main = asRecord(root.invoiceMain);
  if (main?.batchInvoice !== undefined) error(ctx, 'UNSUPPORTED_BATCH_INVOICE', 'Batch modification documents require a dedicated adapter path.', 'InvoiceData.invoiceMain.batchInvoice');
  const sourceInvoice = asRecord(main?.invoice);
  if (!sourceInvoice) {
    error(ctx, 'MISSING_INVOICE', 'Expected invoiceMain.invoice.', 'InvoiceData.invoiceMain.invoice');
    return manualReview(ctx);
  }
  if (sourceInvoice.invoiceReference !== undefined) error(ctx, 'UNSUPPORTED_MODIFICATION_DOCUMENT', 'Credit notes and modification documents require explicit document-type semantics.', 'InvoiceData.invoiceMain.invoice.invoiceReference', 'document.typeCode');

  const head = asRecord(sourceInvoice.invoiceHead);
  const detail = asRecord(head?.invoiceDetail);
  const category = text(detail?.invoiceCategory);
  if (category !== 'NORMAL') error(ctx, 'UNSUPPORTED_INVOICE_CATEGORY', `Only OSA NORMAL invoices are supported in adapter v${OSA_ADAPTER_VERSION}; received ${category ?? 'missing'}.`, 'InvoiceData.invoiceMain.invoice.invoiceHead.invoiceDetail.invoiceCategory');

  const currency = requiredString(ctx, detail, 'currencyCode', 'InvoiceData.invoiceMain.invoice.invoiceHead.invoiceDetail.currencyCode', 'document.currency');
  const linesWrapper = asRecord(sourceInvoice.invoiceLines);
  if (text(linesWrapper?.mergedItemIndicator) === 'true') error(ctx, 'MERGED_LINES_NOT_CANONICAL', 'Merged OSA reporting lines cannot be treated as original invoice lines.', 'InvoiceData.invoiceMain.invoice.invoiceLines.mergedItemIndicator', 'lines');
  const sourceLines = asArray(linesWrapper?.line).map(asRecord).filter((line): line is XmlRecord => Boolean(line));
  if (!sourceLines.length) error(ctx, 'MISSING_LINES', 'No OSA invoice lines found.', 'InvoiceData.invoiceMain.invoice.invoiceLines.line', 'lines');

  const lines = sourceLines.map((line, index) => {
    const sourcePath = `InvoiceData.invoiceMain.invoice.invoiceLines.line[${index}]`;
    const targetPath = `lines[${index}]`;
    if (text(line.lineExpressionIndicator) !== 'true') error(ctx, 'NON_QUANTIFIED_LINE', 'Adapter v0.1.0 supports only quantified OSA lines.', `${sourcePath}.lineExpressionIndicator`, `${targetPath}.quantity`);
    if (line.lineDiscountData !== undefined) error(ctx, 'UNSUPPORTED_LINE_DISCOUNT', 'OSA lineDiscountData requires explicit allowance reconciliation.', `${sourcePath}.lineDiscountData`, `${targetPath}.allowancesAndCharges`);
    const amounts = asRecord(line.lineAmountsNormal);
    if (!amounts) error(ctx, 'MISSING_NORMAL_LINE_AMOUNTS', 'Normal line amounts are required.', `${sourcePath}.lineAmountsNormal`, `${targetPath}.netAmount`);
    const netData = asRecord(amounts?.lineNetAmountData);
    const netAmount = requiredString(ctx, netData, 'lineNetAmount', `${sourcePath}.lineAmountsNormal.lineNetAmountData.lineNetAmount`, `${targetPath}.netAmount.amount`);
    const price = requiredString(ctx, line, 'unitPrice', `${sourcePath}.unitPrice`, `${targetPath}.netPrice.amount.amount`);
    return {
      id: requiredString(ctx, line, 'lineNumber', `${sourcePath}.lineNumber`, `${targetPath}.id`),
      item: { name: requiredString(ctx, line, 'lineDescription', `${sourcePath}.lineDescription`, `${targetPath}.item.name`) },
      quantity: {
        value: requiredString(ctx, line, 'quantity', `${sourcePath}.quantity`, `${targetPath}.quantity.value`),
        unitCode: unitCode(ctx, line, sourcePath, `${targetPath}.quantity.unitCode`),
      },
      netPrice: { amount: { amount: price, currency } },
      netAmount: { amount: netAmount, currency },
      taxCategory: mapTaxCategory(ctx, amounts?.lineVatRate, `${sourcePath}.lineAmountsNormal.lineVatRate`, `${targetPath}.taxCategory`),
    };
  });

  const summary = asRecord(sourceInvoice.invoiceSummary);
  const normal = asRecord(summary?.summaryNormal);
  const gross = asRecord(summary?.summaryGrossData);
  if (!normal) error(ctx, 'MISSING_NORMAL_SUMMARY', 'Normal invoice summary is required.', 'InvoiceData.invoiceMain.invoice.invoiceSummary.summaryNormal', 'totals');
  const invoiceNet = requiredString(ctx, normal, 'invoiceNetAmount', 'InvoiceData.invoiceMain.invoice.invoiceSummary.summaryNormal.invoiceNetAmount', 'totals.taxExclusiveAmount.amount');
  const invoiceVat = requiredString(ctx, normal, 'invoiceVatAmount', 'InvoiceData.invoiceMain.invoice.invoiceSummary.summaryNormal.invoiceVatAmount', 'totals.taxTotalAmount.amount');
  const invoiceGross = requiredString(ctx, gross, 'invoiceGrossAmount', 'InvoiceData.invoiceMain.invoice.invoiceSummary.summaryGrossData.invoiceGrossAmount', 'totals.taxInclusiveAmount.amount');
  const breakdowns = asArray(normal?.summaryByVatRate).map((entry, index) => {
    const source = asRecord(entry);
    const sourcePath = `InvoiceData.invoiceMain.invoice.invoiceSummary.summaryNormal.summaryByVatRate[${index}]`;
    return {
      category: mapTaxCategory(ctx, source?.vatRate, `${sourcePath}.vatRate`, `taxBreakdowns[${index}].category`),
      taxableAmount: { amount: requiredString(ctx, asRecord(source?.vatRateNetData), 'vatRateNetAmount', `${sourcePath}.vatRateNetData.vatRateNetAmount`, `taxBreakdowns[${index}].taxableAmount.amount`), currency },
      taxAmount: { amount: requiredString(ctx, asRecord(source?.vatRateVatData), 'vatRateVatAmount', `${sourcePath}.vatRateVatData.vatRateVatAmount`, `taxBreakdowns[${index}].taxAmount.amount`), currency },
    };
  });

  if (ctx.issues.some((issue) => issue.severity === 'error')) return manualReview(ctx);
  const invoiceNumber = requiredString(ctx, root, 'invoiceNumber', 'InvoiceData.invoiceNumber', 'document.id');
  const issueDate = requiredString(ctx, root, 'invoiceIssueDate', 'InvoiceData.invoiceIssueDate', 'document.issueDate');
  const supplier = asRecord(head?.supplierInfo);
  const customer = asRecord(head?.customerInfo);
  const prepaidAmount = options.prepaidAmount ?? '0';
  const payableRoundingAmount = options.payableRoundingAmount ?? '0';
  evidence(ctx, 'adapterOptions.amountDue', 'totals.amountDue.amount', 'caller_evidence', options.amountDue);

  const invoice: CanonicalInvoice = {
    schema: CANONICAL_INVOICE_SCHEMA,
    schemaVersion: CANONICAL_INVOICE_SCHEMA_VERSION,
    semanticModel: { standard: 'EN16931', edition: '2026', customizationId: 'urn:vida:canonical:osa-3.0:v0.1.0' },
    document: {
      id: invoiceNumber,
      typeCode: '380',
      issueDate,
      ...(text(detail?.paymentDate) ? { dueDate: text(detail?.paymentDate)! } : {}),
      ...(text(detail?.invoiceDeliveryDate) ? { taxPointDate: text(detail?.invoiceDeliveryDate)! } : {}),
      currency,
    },
    seller: mapSupplier(ctx, supplier),
    buyer: mapCustomer(ctx, customer),
    lines,
    taxBreakdowns: breakdowns,
    totals: {
      lineNetAmount: { amount: invoiceNet, currency },
      taxExclusiveAmount: { amount: invoiceNet, currency },
      taxTotalAmount: { amount: invoiceVat, currency },
      taxInclusiveAmount: { amount: invoiceGross, currency },
      ...(prepaidAmount !== '0' ? { prepaidAmount: { amount: prepaidAmount, currency } } : {}),
      ...(payableRoundingAmount !== '0' ? { payableRoundingAmount: { amount: payableRoundingAmount, currency } } : {}),
      amountDue: { amount: options.amountDue!, currency },
    },
    provenance: {
      adapter: 'osa',
      adapterVersion: OSA_ADAPTER_VERSION,
      sourceFormat: 'application/xml',
      sourceSchemaVersion: OSA_SCHEMA_VERSION,
      sourceDocumentId: invoiceNumber,
      transformedAt: options.transformedAt,
      contentHash: `sha256:${createHash('sha256').update(xml, 'utf8').digest('hex')}`,
    },
  };

  if (ctx.issues.some((issue) => issue.severity === 'error')) return manualReview(ctx);
  const canonicalValidation = validateCanonicalInvoice(invoice);
  if (!canonicalValidation.valid) {
    for (const issue of canonicalValidation.issues.filter((item) => item.severity === 'error')) {
      error(ctx, `CANONICAL_${issue.code}`, issue.message, undefined, issue.path);
    }
    return manualReview(ctx);
  }
  ctx.issues.push({ severity: 'warning', code: 'XSD_VALIDATION_NOT_PERFORMED', message: `Structure was mapped against adapter rules; validate input separately against the pinned official XSD: ${OSA_OFFICIAL_INVOICE_DATA_XSD}` });
  return { status: 'mapped', invoice, issues: ctx.issues, evidence: ctx.evidence };
}

function manualReview(ctx: MappingContext): OsaAdapterResult {
  return {
    status: 'manual_review',
    reasonCodes: [...new Set(ctx.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.code))],
    issues: ctx.issues,
    evidence: ctx.evidence,
  };
}
