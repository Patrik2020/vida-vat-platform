# OSA 3.0 adapter

`@vida/adapter-osa` transforms a strictly supported subset of NAV Online Számla `InvoiceData` XML into `CanonicalInvoiceV1`.

## Version baseline

- OSA namespace: `http://schemas.nav.gov.hu/OSA/3.0/data`
- adapter version: `0.1.0`
- official schema baseline: NAV `nav-gov-hu/Online-Invoice` commit `cc7a775d6dce361311e409abb9934eb755f2749c`
- canonical target: `vida.canonical-invoice` `1.0.0`, EN 16931:2026 semantic baseline

The pinned official `invoiceData.xsd` URL is exported as `OSA_OFFICIAL_INVOICE_DATA_XSD`.

## Supported in v0.1.0

- standalone `InvoiceData` XML in the OSA 3.0 namespace;
- complete (`completenessIndicator=true`), original `NORMAL` invoices;
- non-merged, quantified invoice lines;
- canonical OSA units with reviewed UNECE unit mappings;
- VAT percentage, exemption, out-of-scope and domestic reverse-charge categories;
- simple and detailed seller/buyer addresses;
- domestic, Community and third-country tax identifiers;
- normal summary totals and VAT breakdowns;
- field-level mapping evidence and SHA-256 source fingerprint.

## Fail-closed boundaries

The adapter returns `manual_review` and stable reason codes instead of guessing when it encounters:

- `completenessIndicator=false`;
- missing EN 16931 amount-due evidence (BT-115 is not semantically present in OSA 3.0);
- simplified, aggregate, batch or modification documents;
- merged reporting lines, unquantified lines or custom units without a reviewed UNECE mapping;
- line discounts requiring explicit allowance reconciliation;
- margin schemes, VAT mismatch or other unsupported VAT-category semantics;
- missing buyer data, including OSA private-person reporting where personal data is intentionally omitted;
- canonical accounting inconsistencies.

`amountDue`, and when relevant `prepaidAmount` and `payableRoundingAmount`, must be supplied from caller-held invoice evidence. Their origin appears in the field-level evidence output.

## Security and validation

Input is limited to 1 MiB. DOCTYPE and ENTITY declarations are rejected. The XML must be well formed and declare the expected OSA 3.0 namespace.

The package does not claim full XSD validation. Production ingestion must validate against the pinned official NAV XSD before calling the semantic adapter. The mapped output is always passed through the canonical model validator.
