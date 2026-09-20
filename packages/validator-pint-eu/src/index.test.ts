import { describe, expect, it } from 'vitest';
import { PINT_EU_BILLING_1_1_1, validatePintEuBillingXml } from './index.js';

type FixtureOptions = {
  currency?: string;
  invoiceType?: string;
  customizationId?: string;
  vatCategory?: string;
  extraRootXml?: string;
  omitBuyerName?: boolean;
};

function fixture(options: FixtureOptions = {}): string {
  const currency = options.currency ?? 'EUR';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
 xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
 xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
 <cbc:CustomizationID>${options.customizationId ?? 'urn:peppol:pint:billing-1@eu-1'}</cbc:CustomizationID>
 <cbc:ProfileID>urn:peppol:bis:billing</cbc:ProfileID>
 <cbc:ID>INV-2026-1</cbc:ID><cbc:IssueDate>2026-09-20</cbc:IssueDate>
 <cbc:InvoiceTypeCode>${options.invoiceType ?? '380'}</cbc:InvoiceTypeCode>
 <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
 ${options.extraRootXml ?? ''}
 <cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Seller Ltd</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
 <cac:AccountingCustomerParty><cac:Party><cac:PartyLegalEntity>${options.omitBuyerName ? '' : '<cbc:RegistrationName>Buyer Ltd</cbc:RegistrationName>'}</cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>
 <cac:TaxTotal><cbc:TaxAmount currencyID="${currency}">27.00</cbc:TaxAmount></cac:TaxTotal>
 <cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="${currency}">100.00</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="${currency}">100.00</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="${currency}">127.00</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="${currency}">127.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
 <cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="${currency}">100.00</cbc:LineExtensionAmount><cac:Item><cbc:Name>Service</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${options.vatCategory ?? 'S'}</cbc:ID><cbc:Percent>27</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="${currency}">100.00</cbc:PriceAmount></cac:Price></cac:InvoiceLine>
</Invoice>`;
}

describe('validatePintEuBillingXml', () => {
  it('passes the implemented PINT-EU 1.1.1 prototype checks without claiming conformance', () => {
    const result = validatePintEuBillingXml(fixture());
    expect(result.status).toBe('prototype_pass');
    expect(result.productionConformance).toBe('not_assessed');
    expect(result.documentType).toBe('Invoice');
    expect(result.executedRuleIds).toContain('UBL-SR-56');
    expect(result.findings).toContainEqual(expect.objectContaining({ ruleId: 'CAPABILITY-FULL-CONFORMANCE', severity: 'warning' }));
  });

  it('pins syntax, profile, Schematron and code-list versions independently', () => {
    expect(PINT_EU_BILLING_1_1_1).toMatchObject({
      profile: { version: '1.1.1', releaseDate: '2026-06-09', status: 'final' },
      baseProfile: { version: '1.1.3' },
      syntax: { id: 'UBL', version: '2.1' },
      schematron: { execution: 'external-required' },
      codeLists: { snapshot: 'PINT-EU-1.1.1-2026-06-09' },
    });
  });

  it('rejects entity declarations before parsing', () => {
    const xml = fixture().replace('<Invoice ', '<!DOCTYPE Invoice [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><Invoice ');
    const result = validatePintEuBillingXml(xml);
    expect(result.status).toBe('prototype_fail');
    expect(result.findings).toContainEqual(expect.objectContaining({ ruleId: 'XML-SEC-01' }));
    expect(result.executedRuleIds).toHaveLength(0);
  });

  it('requires the UBL 2.1 Invoice namespace', () => {
    const result = validatePintEuBillingXml(fixture().replace('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2', 'urn:wrong'));
    expect(result.status).toBe('prototype_fail');
    expect(result.findings).toContainEqual(expect.objectContaining({ ruleId: 'UBL-NS-01' }));
  });

  it('executes required business-term rules', () => {
    const result = validatePintEuBillingXml(fixture({ omitBuyerName: true }));
    expect(result.status).toBe('prototype_fail');
    expect(result.findings).toContainEqual(expect.objectContaining({ ruleId: 'BR-07' }));
  });

  it('applies the PINT-EU 1.1.1 currency delta', () => {
    expect(validatePintEuBillingXml(fixture({ currency: 'XCG' })).status).toBe('prototype_pass');
    const removed = validatePintEuBillingXml(fixture({ currency: 'BGN' }));
    expect(removed.status).toBe('prototype_fail');
    expect(removed.findings).toContainEqual(expect.objectContaining({ ruleId: 'BR-CL-04' }));
  });

  it('rejects invoice type codes 502 and 503 after the 1.1.1 allocation change', () => {
    const result = validatePintEuBillingXml(fixture({ invoiceType: '502' }));
    expect(result.status).toBe('prototype_fail');
    expect(result.findings).toContainEqual(expect.objectContaining({ ruleId: 'BR-CL-01' }));
  });

  it('enforces the new BT-17 cardinality rule UBL-SR-56', () => {
    const originator = '<cac:OriginatorDocumentReference><cbc:ID>A</cbc:ID></cac:OriginatorDocumentReference><cac:OriginatorDocumentReference><cbc:ID>B</cbc:ID></cac:OriginatorDocumentReference>';
    const result = validatePintEuBillingXml(fixture({ extraRootXml: originator }));
    expect(result.status).toBe('prototype_fail');
    expect(result.findings).toContainEqual(expect.objectContaining({ ruleId: 'UBL-SR-56' }));
  });

  it('returns a deterministic evidence hash', () => {
    const first = validatePintEuBillingXml(fixture());
    const second = validatePintEuBillingXml(fixture());
    expect(first.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first.contentHash).toBe(second.contentHash);
  });
});
