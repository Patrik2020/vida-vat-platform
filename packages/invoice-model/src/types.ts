export const CANONICAL_INVOICE_SCHEMA = 'vida.canonical-invoice' as const;
export const CANONICAL_INVOICE_SCHEMA_VERSION = '1.0.0' as const;

export type DecimalString = string;
export type IsoDate = string;
export type IsoCurrencyCode = string;
export type IsoCountryCode = string;

export type InvoiceTypeCode = '380' | '381' | '384' | '389';
export type TaxCategoryCode = 'S' | 'Z' | 'E' | 'AE' | 'K' | 'G' | 'O' | 'L' | 'M';

export type Identifier = {
  value: string;
  schemeId?: string;
};

export type Address = {
  line1?: string;
  line2?: string;
  city?: string;
  postalCode?: string;
  countryCode: IsoCountryCode;
  subdivision?: string;
};

export type Party = {
  name: string;
  legalName?: string;
  identifiers?: Identifier[];
  vatIdentifiers?: Identifier[];
  address: Address;
  contact?: {
    name?: string;
    email?: string;
    telephone?: string;
  };
};

export type Money = {
  amount: DecimalString;
  currency: IsoCurrencyCode;
};

export type AllowanceCharge = {
  kind: 'allowance' | 'charge';
  amount: Money;
  reason?: string;
  reasonCode?: string;
};

export type TaxCategory = {
  code: TaxCategoryCode;
  rate?: DecimalString;
  exemptionReason?: string;
  exemptionReasonCode?: string;
};

export type InvoiceLine = {
  id: string;
  item: {
    name: string;
    description?: string;
    sellerItemId?: string;
    buyerItemId?: string;
    classifications?: Identifier[];
  };
  quantity: {
    value: DecimalString;
    unitCode: string;
  };
  netPrice: {
    amount: Money;
    baseQuantity?: DecimalString;
  };
  allowancesAndCharges?: AllowanceCharge[];
  netAmount: Money;
  taxCategory: TaxCategory;
};

export type TaxBreakdown = {
  category: TaxCategory;
  taxableAmount: Money;
  taxAmount: Money;
};

export type InvoiceTotals = {
  lineNetAmount: Money;
  allowanceTotalAmount?: Money;
  chargeTotalAmount?: Money;
  taxExclusiveAmount: Money;
  taxTotalAmount: Money;
  taxInclusiveAmount: Money;
  prepaidAmount?: Money;
  payableRoundingAmount?: Money;
  amountDue: Money;
};

export type DocumentReference = {
  id: string;
  type: 'purchase_order' | 'contract' | 'preceding_invoice' | 'supporting_document' | 'other';
  description?: string;
};

export type SourceProvenance = {
  adapter: 'manual' | 'osa' | 'pint-eu-ubl' | 'hu-vida' | string;
  adapterVersion: string;
  sourceFormat: string;
  sourceSchemaVersion?: string;
  sourceDocumentId?: string;
  transformedAt: string;
  contentHash?: string;
};

export type CanonicalInvoiceV1 = {
  schema: typeof CANONICAL_INVOICE_SCHEMA;
  schemaVersion: typeof CANONICAL_INVOICE_SCHEMA_VERSION;
  semanticModel: {
    standard: 'EN16931';
    edition: '2026';
    customizationId?: string;
    profileId?: string;
  };
  document: {
    id: string;
    typeCode: InvoiceTypeCode;
    issueDate: IsoDate;
    dueDate?: IsoDate;
    taxPointDate?: IsoDate;
    currency: IsoCurrencyCode;
    buyerReference?: string;
    notes?: string[];
  };
  seller: Party;
  buyer: Party;
  lines: InvoiceLine[];
  documentAllowancesAndCharges?: AllowanceCharge[];
  taxBreakdowns: TaxBreakdown[];
  totals: InvoiceTotals;
  references?: DocumentReference[];
  payment?: {
    meansCode?: string;
    terms?: string;
    paymentReference?: string;
    accountIdentifier?: Identifier;
  };
  provenance: SourceProvenance;
};

export type CanonicalInvoice = CanonicalInvoiceV1;

export type ValidationIssue = {
  severity: 'error' | 'warning';
  code: string;
  path: string;
  message: string;
};

export type CanonicalInvoiceValidationResult =
  | { valid: true; issues: ValidationIssue[] }
  | { valid: false; issues: ValidationIssue[] };
