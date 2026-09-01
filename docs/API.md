# Hungary VAT API — Phase 1 MVP

Base path: `/v1/hu/vat`

Current ruleset: `HU-VAT-2026-004`

Current regulatory verification window: through `2026-09-01`.

The MVP is deliberately fail-closed. Requests that require rules after the latest verified date, or classifications that cannot be proven from supported facts, are rejected or returned as `manual_review`.

## API contract and developer UI

- OpenAPI 3.0 document: `GET /openapi.json`
- Swagger UI: `GET /docs`

The OpenAPI document is the current machine-readable Phase 1 contract. Runtime validation remains implemented with Zod; contract/runtime parity is covered by API integration tests and should remain a release gate as the API grows.

## GET `/rates`

```http
GET /v1/hu/vat/rates?effectiveDate=2026-09-01
```

Returns the supported Hungarian VAT rate catalogue: 0%, 5%, 18%, 27%, plus source metadata and the verification date.

A rate existing in the catalogue does **not** mean every product can use that rate. Eligibility is a separate classification decision.

## POST `/classify-rate`

### 0% — daily newspaper

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

### 0% — qualifying medicine

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

The current MVP recognises the supported 0% prescription / human magistral medicine conditions from 2026-09-01.

### 18% — supported reduced-rate subset

```json
{
  "effectiveDate": "2026-09-01",
  "classification": {
    "kind": "reduced_rate_18_product",
    "category": "cereal_flour_starch_or_milk_preparation",
    "customsTariffCode": "1904 10 10",
    "statutoryDescriptionConfirmed": true
  }
}
```

Supported categories currently include selected NAV 2026/1 subsets for:

- milk / dairy tariff groups where the MVP can apply a bounded mapping;
- flavoured milk tariff groups;
- selected cereal, flour, starch or milk preparations.

The caller must confirm that the product meets the statutory textual description. A matching VTSZ alone is not treated as sufficient.

### 5% — supported 2026 domesticated-cattle subset

```json
{
  "effectiveDate": "2026-09-01",
  "classification": {
    "kind": "domesticated_cattle_food_product",
    "customsTariffCode": "0201 30 00",
    "domesticatedCattle": true,
    "fitForHumanConsumption": true,
    "preservation": "chilled"
  }
}
```

The automated subset is based on the VTSZ groups and textual conditions described in NAV 2026/2 for the Áfa tv. 3. számú melléklet I. rész 60. sora. Salted/brined, dried and smoked products are not accepted by this rule.

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

Example result:

```json
{
  "rulesetId": "HU-VAT-2026-004",
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

```json
{
  "periodEnd": "2026-08-31",
  "invoiceDate": "2026-08-20",
  "dueDate": "2026-08-25"
}
```

The resolver implements the currently supported Áfa tv. 58. § periodic-settlement logic, including the maximum period-end + 60-day cap. If the resulting tax point falls after the latest legally verified date, the request fails closed.

## POST `/reverse-charge/domestic-construction`

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

This endpoint currently covers only the explicitly modelled domestic construction scenario, not every reverse-charge category in Áfa tv. 142. §.

## POST `/exemptions/aam/threshold`

Evaluates the 2026 Hungarian alanyi adómentesség turnover threshold. The caller must supply turnover values already calculated under Áfa tv. 188. §, including the statutory inclusions/exclusions; the MVP does not derive those values from raw transactions yet.

### Existing taxpayer

```json
{
  "effectiveDate": "2026-09-01",
  "establishedBefore2026": true,
  "valuesCalculatedUnderSection188": true,
  "priorYearRelevantDomesticTurnoverHuf": "19000000",
  "currentYearExpectedRelevantDomesticTurnoverHuf": "19500000",
  "currentYearActualRelevantDomesticTurnoverHuf": "12000000"
}
```

For an existing taxpayer, the 2026 annual threshold is `20000000` HUF and the response uses `thresholdMode: "annual"`.

### Taxpayer registered during 2026 — Áfa tv. 189. §

```json
{
  "effectiveDate": "2026-09-01",
  "establishedBefore2026": false,
  "registrationDate": "2026-07-01",
  "valuesCalculatedUnderSection188": true,
  "priorYearRelevantDomesticTurnoverHuf": "0",
  "currentYearExpectedRelevantDomesticTurnoverHuf": "10000000",
  "currentYearActualRelevantDomesticTurnoverHuf": "5000000"
}
```

For a taxpayer registered on 2026-07-01, the evaluator counts 184 calendar days from registration through 31 December, inclusive. The annual 20,000,000 HUF threshold is therefore compared as the exact fraction:

`20,000,000 × 184 / 365`

The response exposes `thresholdHuf: "10082191"` as the whole-forint floor for display, but **eligibility is not decided using that rounded display value**. The engine compares integer cross-products against the exact fraction, so a one-forint boundary cannot be distorted by floating-point or display rounding.

Example response fields:

```json
{
  "rulesetId": "HU-VAT-2026-004",
  "status": "eligible_within_threshold",
  "thresholdMode": "time_proportional",
  "annualThresholdHuf": "20000000",
  "thresholdHuf": "10082191",
  "registrationDate": "2026-07-01",
  "activeDays": 184,
  "daysInYear": 365,
  "thresholdExact": {
    "numeratorHufDays": "3680000000",
    "denominatorDays": "365"
  }
}
```

If `establishedBefore2026` is `false` but `registrationDate` is omitted, the evaluator returns `manual_review`. A registration date outside 2026, or later than `effectiveDate`, is rejected.

Possible statuses include:

- `eligible_within_threshold`;
- `not_eligible_for_choice`;
- `threshold_exceeded`;
- `manual_review`.

The endpoint does not yet determine the exact transaction ending the exemption, later re-election restrictions, or every special exclusion from raw transaction data.

## Error contract

Validation and domain failures use a stable envelope:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Request validation failed",
    "requestId": "req-1",
    "details": []
  }
}
```

Typical HTTP behavior:

- `400` — malformed or incomplete input;
- `422` — syntactically valid request that cannot be processed under the currently verified rules, including unsupported effective dates.

Current error codes:

- `invalid_request`;
- `unsupported_effective_date`;
- `classification_failed`;
- `calculation_failed`;
- `tax_point_failed`;
- `reverse_charge_evaluation_failed`;
- `aam_threshold_evaluation_failed`.

The `requestId` is included so a future commercial platform can correlate client-visible errors with logs and support/audit records.

## Compliance boundary

This MVP separates four concerns:

1. **classification** — what VAT treatment/rate is legally applicable;
2. **exemption eligibility** — whether a separately modelled exemption threshold/condition applies;
3. **tax point / mechanism** — when and by whom VAT is accounted for;
4. **arithmetic** — exact net/VAT/gross computation.

Keeping these separate is intentional: arithmetic must never silently substitute for legal classification.
