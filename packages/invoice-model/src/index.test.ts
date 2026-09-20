import { describe, expect, it } from 'vitest';
import {
  CANONICAL_INVOICE_SCHEMA,
  CANONICAL_INVOICE_SCHEMA_VERSION,
  validateCanonicalInvoice,
  type CanonicalInvoice,
} from './index.js';

function invoiceFixture(): CanonicalInvoice {
  return {
    schema: CANONICAL_INVOICE_SCHEMA,
    schemaVersion: CANONICAL_INVOICE_SCHEMA_VERSION,
    semanticModel: { standard: 'EN16931', edition: '2026' },
    document: { id: 'INV-2026-0001', typeCode: '380', issueDate: '2026-09-20', dueDate: '2026-10-05', currency: 'HUF' },
    seller: { name: 'Eladó Kft.', vatIdentifiers: [{ value: 'HU12345678', schemeId: 'VAT' }], address: { city: 'Budapest', countryCode: 'HU' } },
    buyer: { name: 'Vevő Kft.', vatIdentifiers: [{ value: 'HU87654321', schemeId: 'VAT' }], address: { city: 'Budapest', countryCode: 'HU' } },
    lines: [
      {
        id: '1',
        item: { name: 'Szolgáltatás' },
        quantity: { value: '2', unitCode: 'C62' },
        netPrice: { amount: { amount: '5000.00', currency: 'HUF' } },
        netAmount: { amount: '10000.00', currency: 'HUF' },
        taxCategory: { code: 'S', rate: '27' },
      },
    ],
    documentAllowancesAndCharges: [
      { kind: 'allowance', amount: { amount: '1000', currency: 'HUF' }, reason: 'Kedvezmény' },
      { kind: 'charge', amount: { amount: '500', currency: 'HUF' }, reason: 'Kiszállítás' },
    ],
    taxBreakdowns: [{ category: { code: 'S', rate: '27' }, taxableAmount: { amount: '9500', currency: 'HUF' }, taxAmount: { amount: '2565', currency: 'HUF' } }],
    totals: {
      lineNetAmount: { amount: '10000', currency: 'HUF' },
      allowanceTotalAmount: { amount: '1000', currency: 'HUF' },
      chargeTotalAmount: { amount: '500', currency: 'HUF' },
      taxExclusiveAmount: { amount: '9500', currency: 'HUF' },
      taxTotalAmount: { amount: '2565', currency: 'HUF' },
      taxInclusiveAmount: { amount: '12065', currency: 'HUF' },
      prepaidAmount: { amount: '1000', currency: 'HUF' },
      amountDue: { amount: '11065', currency: 'HUF' },
    },
    provenance: {
      adapter: 'manual',
      adapterVersion: '1.0.0',
      sourceFormat: 'application/json',
      sourceDocumentId: 'INV-2026-0001',
      transformedAt: '2026-09-20T10:00:00Z',
      contentHash: 'sha256:fixture',
    },
  };
}

describe('validateCanonicalInvoice', () => {
  it('accepts an internally consistent EN 16931:2026 canonical invoice', () => {
    expect(validateCanonicalInvoice(invoiceFixture())).toEqual({ valid: true, issues: [] });
  });

  it('uses exact decimal arithmetic and accepts equivalent scales', () => {
    const invoice = invoiceFixture();
    invoice.totals.lineNetAmount.amount = '10000.0000';
    invoice.totals.taxInclusiveAmount.amount = '12065.0';
    expect(validateCanonicalInvoice(invoice).valid).toBe(true);
  });

  it('reports deterministic total mismatches instead of correcting source data', () => {
    const invoice = invoiceFixture();
    invoice.totals.amountDue.amount = '11064.99';
    const result = validateCanonicalInvoice(invoice);
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'AMOUNT_DUE_MISMATCH', path: 'totals.amountDue.amount' }));
  });

  it('rejects mixed currencies', () => {
    const invoice = invoiceFixture();
    invoice.lines[0]!.netAmount.currency = 'EUR';
    const result = validateCanonicalInvoice(invoice);
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'CURRENCY_MISMATCH' }));
  });

  it('requires exemption evidence for exempt categories', () => {
    const invoice = invoiceFixture();
    invoice.lines[0]!.taxCategory = { code: 'E' };
    const result = validateCanonicalInvoice(invoice);
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'MISSING_EXEMPTION_REASON' }));
  });

  it('warns when source hash evidence is not provided', () => {
    const invoice = invoiceFixture();
    delete invoice.provenance.contentHash;
    const result = validateCanonicalInvoice(invoice);
    expect(result.valid).toBe(true);
    expect(result.issues).toContainEqual(expect.objectContaining({ severity: 'warning', code: 'MISSING_CONTENT_HASH' }));
  });
});
