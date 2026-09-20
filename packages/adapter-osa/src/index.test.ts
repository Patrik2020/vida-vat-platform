import { describe, expect, it } from 'vitest';
import { mapOsaInvoiceDataXml, OSA_OFFICIAL_SCHEMA_COMMIT } from './index.js';

type FixtureOptions = {
  completeness?: boolean;
  category?: string;
  vatRateXml?: string;
  summaryVatRateXml?: string;
  gross?: string;
  extraInvoiceXml?: string;
};

function fixture(options: FixtureOptions = {}): string {
  const completeness = options.completeness ?? true;
  const category = options.category ?? 'NORMAL';
  const vatRateXml = options.vatRateXml ?? '<vatPercentage>0.27</vatPercentage>';
  const summaryVatRateXml = options.summaryVatRateXml ?? vatRateXml;
  const gross = options.gross ?? '127.00';
  return `<?xml version="1.0" encoding="UTF-8"?>
<InvoiceData xmlns="http://schemas.nav.gov.hu/OSA/3.0/data" xmlns:base="http://schemas.nav.gov.hu/OSA/3.0/base">
  <invoiceNumber>TEST-2026-1</invoiceNumber>
  <invoiceIssueDate>2026-09-20</invoiceIssueDate>
  <completenessIndicator>${completeness}</completenessIndicator>
  <invoiceMain><invoice>
    ${options.extraInvoiceXml ?? ''}
    <invoiceHead>
      <supplierInfo>
        <supplierTaxNumber><base:taxpayerId>12345678</base:taxpayerId><base:vatCode>2</base:vatCode><base:countyCode>42</base:countyCode></supplierTaxNumber>
        <supplierName>Eladó Kft.</supplierName>
        <supplierAddress><base:detailedAddress><base:countryCode>HU</base:countryCode><base:postalCode>1181</base:postalCode><base:city>Budapest</base:city><base:streetName>Fő</base:streetName><base:publicPlaceCategory>utca</base:publicPlaceCategory><base:number>1</base:number></base:detailedAddress></supplierAddress>
      </supplierInfo>
      <customerInfo>
        <customerVatStatus>DOMESTIC</customerVatStatus>
        <customerVatData><customerTaxNumber><base:taxpayerId>87654321</base:taxpayerId><base:vatCode>2</base:vatCode><base:countyCode>43</base:countyCode></customerTaxNumber></customerVatData>
        <customerName>Vevő Kft.</customerName>
        <customerAddress><base:simpleAddress><base:countryCode>HU</base:countryCode><base:postalCode>1111</base:postalCode><base:city>Budapest</base:city><base:additionalAddressDetail>Minta tér 2.</base:additionalAddressDetail></base:simpleAddress></customerAddress>
      </customerInfo>
      <invoiceDetail><invoiceCategory>${category}</invoiceCategory><invoiceDeliveryDate>2026-09-20</invoiceDeliveryDate><currencyCode>HUF</currencyCode><exchangeRate>1</exchangeRate><paymentDate>2026-10-05</paymentDate><invoiceAppearance>ELECTRONIC</invoiceAppearance></invoiceDetail>
    </invoiceHead>
    <invoiceLines><mergedItemIndicator>false</mergedItemIndicator><line>
      <lineNumber>1</lineNumber><lineExpressionIndicator>true</lineExpressionIndicator><lineNatureIndicator>SERVICE</lineNatureIndicator>
      <lineDescription>Teszt szolgáltatás</lineDescription><quantity>1.00</quantity><unitOfMeasure>PIECE</unitOfMeasure><unitPrice>100.00</unitPrice>
      <lineAmountsNormal><lineNetAmountData><lineNetAmount>100.00</lineNetAmount><lineNetAmountHUF>100.00</lineNetAmountHUF></lineNetAmountData><lineVatRate>${vatRateXml}</lineVatRate><lineVatData><lineVatAmount>27.00</lineVatAmount><lineVatAmountHUF>27.00</lineVatAmountHUF></lineVatData></lineAmountsNormal>
    </line></invoiceLines>
    <invoiceSummary><summaryNormal><summaryByVatRate><vatRate>${summaryVatRateXml}</vatRate><vatRateNetData><vatRateNetAmount>100.00</vatRateNetAmount><vatRateNetAmountHUF>100.00</vatRateNetAmountHUF></vatRateNetData><vatRateVatData><vatRateVatAmount>27.00</vatRateVatAmount><vatRateVatAmountHUF>27.00</vatRateVatAmountHUF></vatRateVatData></summaryByVatRate><invoiceNetAmount>100.00</invoiceNetAmount><invoiceNetAmountHUF>100.00</invoiceNetAmountHUF><invoiceVatAmount>27.00</invoiceVatAmount><invoiceVatAmountHUF>27.00</invoiceVatAmountHUF></summaryNormal><summaryGrossData><invoiceGrossAmount>${gross}</invoiceGrossAmount><invoiceGrossAmountHUF>${gross}</invoiceGrossAmountHUF></summaryGrossData></invoiceSummary>
  </invoice></invoiceMain>
</InvoiceData>`;
}

const options = { transformedAt: '2026-09-20T12:00:00Z', amountDue: '127.00' } as const;

describe('mapOsaInvoiceDataXml', () => {
  it('maps a complete supported OSA 3.0 normal invoice', () => {
    const result = mapOsaInvoiceDataXml(fixture(), options);
    expect(result.status).toBe('mapped');
    if (result.status !== 'mapped') return;
    expect(result.invoice.document).toMatchObject({ id: 'TEST-2026-1', currency: 'HUF', dueDate: '2026-10-05', taxPointDate: '2026-09-20' });
    expect(result.invoice.lines[0]).toMatchObject({ quantity: { value: '1.00', unitCode: 'C62' }, taxCategory: { code: 'S', rate: '27' } });
    expect(result.invoice.seller.identifiers?.[0]?.value).toBe('12345678-2-42');
    expect(result.invoice.provenance.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.evidence).toContainEqual(expect.objectContaining({ transformation: 'fraction_to_percent', targetPath: 'lines[0].taxCategory.rate' }));
  });

  it('fails closed when OSA says the reporting payload is not the complete invoice', () => {
    const result = mapOsaInvoiceDataXml(fixture({ completeness: false }), options);
    expect(result.status).toBe('manual_review');
    if (result.status === 'manual_review') expect(result.reasonCodes).toContain('INCOMPLETE_SOURCE_DOCUMENT');
  });

  it('requires separate amount-due evidence because OSA has no BT-115 equivalent', () => {
    const result = mapOsaInvoiceDataXml(fixture(), { transformedAt: options.transformedAt });
    expect(result.status).toBe('manual_review');
    if (result.status === 'manual_review') expect(result.reasonCodes).toContain('MISSING_AMOUNT_DUE_EVIDENCE');
  });

  it('does not guess mappings for simplified invoices', () => {
    const result = mapOsaInvoiceDataXml(fixture({ category: 'SIMPLIFIED' }), options);
    expect(result.status).toBe('manual_review');
    if (result.status === 'manual_review') expect(result.reasonCodes).toContain('UNSUPPORTED_INVOICE_CATEGORY');
  });

  it('does not guess unsupported VAT categories', () => {
    const vat = '<marginSchemeIndicator>TRAVEL_AGENCY</marginSchemeIndicator>';
    const result = mapOsaInvoiceDataXml(fixture({ vatRateXml: vat, summaryVatRateXml: vat }), options);
    expect(result.status).toBe('manual_review');
    if (result.status === 'manual_review') expect(result.reasonCodes).toContain('UNSUPPORTED_VAT_CATEGORY');
  });

  it('passes mapped data through canonical accounting validation', () => {
    const result = mapOsaInvoiceDataXml(fixture({ gross: '126.99' }), { ...options, amountDue: '126.99' });
    expect(result.status).toBe('manual_review');
    if (result.status === 'manual_review') expect(result.reasonCodes).toContain('CANONICAL_TAX_INCLUSIVE_TOTAL_MISMATCH');
  });

  it('rejects XML entity declarations before parsing', () => {
    const xml = fixture().replace('<InvoiceData ', '<!DOCTYPE InvoiceData [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><InvoiceData ');
    const result = mapOsaInvoiceDataXml(xml, options);
    expect(result.status).toBe('manual_review');
    if (result.status === 'manual_review') expect(result.reasonCodes).toContain('UNSAFE_XML_DECLARATION');
  });

  it('pins the official NAV schema revision used for adapter development', () => {
    expect(OSA_OFFICIAL_SCHEMA_COMMIT).toBe('cc7a775d6dce361311e409abb9934eb755f2749c');
  });
});
