import { isPrototypeCurrencyCode, isPrototypeInvoiceTypeCode, PINT_EU_1_1_1_CODE_LIST_OVERLAY } from '../codelists/pint-eu-1.1.1.js';
import type { PintEuDocumentType, PintEuFinding } from '../types.js';
import { asArray, asRecord, attribute, valueOf, type XmlRecord } from '../xml.js';

export type PintEuRuleContext = { documentType: PintEuDocumentType; root: XmlRecord };
export type PintEuPrototypeRule = { id: string; evaluate(context: PintEuRuleContext): PintEuFinding[] };

function fatal(ruleId: string, message: string, path: string, layer: PintEuFinding['layer'] = 'pint-eu'): PintEuFinding {
  return { severity: 'fatal', ruleId, layer, message, path };
}

function required(id: string, key: string, label: string): PintEuPrototypeRule {
  return {
    id,
    evaluate: ({ root }) => valueOf(root[key]) ? [] : [fatal(id, `${label} is required.`, `/${key}`)],
  };
}

export const PINT_EU_1_1_1_PROTOTYPE_RULES: readonly PintEuPrototypeRule[] = Object.freeze([
  required('BR-01', 'CustomizationID', 'Specification identifier (BT-24)'),
  required('BR-02', 'ID', 'Document number (BT-1)'),
  required('BR-03', 'IssueDate', 'Issue date (BT-2)'),
  {
    id: 'BR-04',
    evaluate: ({ documentType, root }) => {
      const key = documentType === 'Invoice' ? 'InvoiceTypeCode' : 'CreditNoteTypeCode';
      return valueOf(root[key]) ? [] : [fatal('BR-04', 'Document type code (BT-3) is required.', `/${key}`)];
    },
  },
  required('BR-05', 'DocumentCurrencyCode', 'Document currency (BT-5)'),
  {
    id: 'BR-CL-04',
    evaluate: ({ root }) => {
      const value = valueOf(root.DocumentCurrencyCode);
      return !value || isPrototypeCurrencyCode(value) ? [] : [fatal('BR-CL-04', `Currency ${value} is not accepted by the pinned prototype code-list overlay.`, '/DocumentCurrencyCode', 'code-list')];
    },
  },
  {
    id: 'BR-CL-01',
    evaluate: ({ documentType, root }) => {
      const key = documentType === 'Invoice' ? 'InvoiceTypeCode' : 'CreditNoteTypeCode';
      const value = valueOf(root[key]);
      return !value || isPrototypeInvoiceTypeCode(value) ? [] : [fatal('BR-CL-01', `Document type code ${value} is not accepted by the pinned PINT-EU 1.1.1 overlay.`, `/${key}`, 'code-list')];
    },
  },
  {
    id: 'IBR-SR-63',
    evaluate: ({ root }) => {
      const value = valueOf(root.CustomizationID);
      return value?.includes('*') ? [fatal('IBR-SR-63', 'Specification identifier must not contain a wildcard.', '/CustomizationID')] : [];
    },
  },
  {
    id: 'BR-06',
    evaluate: ({ root }) => valueOf(asRecord(asRecord(asRecord(root.AccountingSupplierParty)?.Party)?.PartyLegalEntity)?.RegistrationName)
      ? [] : [fatal('BR-06', 'Seller name (BT-27) is required.', '/AccountingSupplierParty/Party/PartyLegalEntity/RegistrationName')],
  },
  {
    id: 'BR-07',
    evaluate: ({ root }) => valueOf(asRecord(asRecord(asRecord(root.AccountingCustomerParty)?.Party)?.PartyLegalEntity)?.RegistrationName)
      ? [] : [fatal('BR-07', 'Buyer name (BT-44) is required.', '/AccountingCustomerParty/Party/PartyLegalEntity/RegistrationName')],
  },
  {
    id: 'BR-16',
    evaluate: ({ documentType, root }) => {
      const key = documentType === 'Invoice' ? 'InvoiceLine' : 'CreditNoteLine';
      return asArray(root[key]).length > 0 ? [] : [fatal('BR-16', 'At least one invoice line (BG-25) is required.', `/${key}`)];
    },
  },
  {
    id: 'BR-CO-04',
    evaluate: ({ documentType, root }) => {
      const key = documentType === 'Invoice' ? 'InvoiceLine' : 'CreditNoteLine';
      return asArray(root[key]).flatMap((line, index) => {
        const category = valueOf(asRecord(asRecord(asRecord(line)?.Item)?.ClassifiedTaxCategory)?.ID);
        return category ? [] : [fatal('BR-CO-04', 'Each line requires a VAT category code (BT-151).', `/${key}[${index}]/Item/ClassifiedTaxCategory/ID`)];
      });
    },
  },
  {
    id: 'BR-CL-17',
    evaluate: ({ documentType, root }) => {
      const key = documentType === 'Invoice' ? 'InvoiceLine' : 'CreditNoteLine';
      return asArray(root[key]).flatMap((line, index) => {
        const category = valueOf(asRecord(asRecord(asRecord(line)?.Item)?.ClassifiedTaxCategory)?.ID);
        return !category || PINT_EU_1_1_1_CODE_LIST_OVERLAY.vatCategory.has(category)
          ? [] : [fatal('BR-CL-17', `VAT category ${category} is not in the PINT-EU 1.1.1 prototype set.`, `/${key}[${index}]/Item/ClassifiedTaxCategory/ID`, 'code-list')];
      });
    },
  },
  {
    id: 'BR-CL-03',
    evaluate: ({ root }) => {
      const nodes = [
        ...asArray(asRecord(root.LegalMonetaryTotal)?.LineExtensionAmount),
        ...asArray(asRecord(root.LegalMonetaryTotal)?.TaxExclusiveAmount),
        ...asArray(asRecord(root.LegalMonetaryTotal)?.TaxInclusiveAmount),
        ...asArray(asRecord(root.LegalMonetaryTotal)?.PayableAmount),
      ];
      return nodes.flatMap((node, index) => {
        const currency = attribute(node, 'currencyID');
        return currency && isPrototypeCurrencyCode(currency) ? [] : [fatal('BR-CL-03', 'Monetary amounts require an accepted currencyID.', `/LegalMonetaryTotal/*[${index}]`, 'code-list')];
      });
    },
  },
  {
    id: 'UBL-SR-56',
    evaluate: ({ root }) => asArray(root.OriginatorDocumentReference).length <= 1
      ? [] : [fatal('UBL-SR-56', 'At most one Originator document reference (BT-17) is allowed.', '/OriginatorDocumentReference')],
  },
]);
