# Hungary VAT API — Phase 1 MVP

Base path: `/v1/hu/vat`

Current ruleset: `HU-VAT-2026-002`

Current regulatory verification window: through `2026-09-01`.

The MVP is deliberately fail-closed. Requests that require rules after the latest verified date, or classifications that cannot be proven from supported facts, are rejected or returned as `manual_review`.

## GET `/rates`

Example:

```http
GET /v1/hu/vat/rates?effectiveDate=2026-09-01
```

Returns the supported Hungarian VAT rate catalogue: 0%, 5%, 18%, 27%, plus source metadata and the verification date.

A rate existing in the catalogue does **not** mean every product can use that rate. Eligibility is a separate classification decision.

## POST `/classify-rate`

### Supported deterministic classification — daily newspaper

```json
{
  "effectiveDate": "2026-09-01",
  "classification": {
    "kind": "daily_newspaper",
    "customsTariffCode": "4902",
    "issuesPerWeek": 5
  }
}
```

Qualifying cases return `rate: 0`. Insufficient facts return `status: "manual_review"`; the API never invents a 27% fallback.

### Supported deterministic classification — medicine

```json
{
  "effectiveDate": "2026-09-01",
  "classification": {
    "kind": "medicine",
    "prescriptionRequired": true,
    "magistral": false,
    "humanUse": true
  }
}
```

The current MVP recognises the 0% conditions implemented from 2026-09-01 for supported prescription / human magistral medicine cases.

### Caller-confirmed rate

```json
{
  "effectiveDate": "2026-09-01",
  "classification": {
    "kind": "declared_rate",
    "rate": 18,
    "legalBasisConfirmed": true
  }
}
```

This mode does not perform product classification. It records that the caller has independently confirmed the legal basis and enables deterministic arithmetic downstream.

## POST `/calculate`

Net-to-gross example:

```json
{
  "effectiveDate": "2026-09-01",
  "amount": "100.00",
  "amountType": "net",
  "treatment": "taxable",
  "rate": 27,
  "scale": 2
}
```

Result:

```json
{
  "netAmount": "100.00",
  "vatAmount": "27.00",
  "grossAmount": "127.00"
}
```

The calculation engine uses integer minor-unit arithmetic and half-up rounding at the caller-selected scale, avoiding binary floating-point VAT arithmetic.

Supported treatments:

- `taxable` — requires 0, 5, 18 or 27 rate;
- `exempt` — supplier VAT amount is zero;
- `reverse_charge` — supplier VAT amount is zero and recipient accounting is flagged.

Invoice-level aggregation, foreign-currency conversion and final production rounding policy are not yet part of this endpoint.

## POST `/tax-point/periodic`

Example:

```json
{
  "periodEnd": "2026-08-31",
  "invoiceDate": "2026-08-20",
  "dueDate": "2026-08-25"
}
```

The resolver implements the currently supported Áfa tv. 58. § periodic-settlement logic:

- period end as the default;
- earlier invoice date when both invoice and due date precede period end;
- later due date when due after period end;
- maximum period-end + 60-day cap.

If the resulting tax point falls after the latest legally verified date, the request fails closed.

## POST `/reverse-charge/domestic-construction`

Example:

```json
{
  "effectiveDate": "2026-09-01",
  "supplierDomesticVatRegistered": true,
  "recipientDomesticVatRegistered": true,
  "supplierTaxPayableStatus": true,
  "recipientTaxPayableStatus": true,
  "constructionAssemblyWork": true,
  "propertyActivity": "transform",
  "authorityPermitOrNotificationRequired": true,
  "requiredDeclarationProvided": true
}
```

The response contains:

- `eligible`;
- every evaluated condition;
- failed checks when not eligible;
- legal/source references.

This endpoint currently covers only the explicitly modelled domestic construction scenario, not every reverse-charge category in Áfa tv. 142. §.

## Error behavior

Typical HTTP behavior:

- `400` — malformed or incomplete input;
- `422` — syntactically valid request that cannot be processed under the currently verified rules, including unsupported effective dates.

Application responses include a stable machine-readable `error` code and explanatory information. A formal versioned error schema remains a Phase 1 hardening task.

## Compliance boundary

This MVP separates three concerns:

1. **classification** — what VAT treatment/rate is legally applicable;
2. **tax point / mechanism** — when and by whom VAT is accounted for;
3. **arithmetic** — exact net/VAT/gross computation.

Keeping these separate is intentional: arithmetic must never silently substitute for legal classification.
