# Hungary VAT API — Phase 1 MVP

Base path: `/v1/hu/vat`

Current ruleset: `HU-VAT-2026-003`

Current regulatory verification window: through `2026-09-01`.

The MVP is deliberately fail-closed. Requests that require rules after the latest verified date, or classifications that cannot be proven from supported facts, are rejected or returned as `manual_review`.

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

Checks the 2026 domestic small-business VAT exemption threshold for an existing business.

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

The 2026 threshold is `20000000` HUF. Possible statuses include:

- `eligible_within_threshold`;
- `not_eligible_for_choice`;
- `threshold_exceeded`;
- `manual_review`.

The caller must supply turnover values already calculated according to Áfa tv. 188. §, including the statutory exclusions. The MVP does not yet calculate those exclusions from raw transactions.

Newly registered businesses currently return `manual_review` because the Áfa tv. 189. § time-proportional threshold logic is not yet implemented.

The endpoint also does not yet determine the exact transaction ending the exemption or later re-election restrictions.

## Error behavior

Typical HTTP behavior:

- `400` — malformed or incomplete input;
- `422` — syntactically valid request that cannot be processed under the currently verified rules, including unsupported effective dates.

A formal versioned error schema remains a Phase 1 hardening task.

## Compliance boundary

This MVP separates four concerns:

1. **classification** — what VAT treatment/rate is legally applicable;
2. **exemption eligibility** — whether a separately modelled exemption threshold/condition applies;
3. **tax point / mechanism** — when and by whom VAT is accounted for;
4. **arithmetic** — exact net/VAT/gross computation.

Keeping these separate is intentional: arithmetic must never silently substitute for legal classification.
