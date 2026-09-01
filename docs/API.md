# Hungary VAT API — Phase 1 MVP

Base path: `/v1/hu/vat`

Current ruleset: `HU-VAT-2026-006`

Current regulatory verification window: through `2026-09-01`.

The MVP is deliberately fail-closed. Requests that require rules after the latest verified date, or classifications that cannot be proven from supported facts, are rejected or returned as `manual_review`.

## API contract and developer UI

- OpenAPI 3.0 document: `GET /openapi.json`
- Swagger UI: `GET /docs`

Runtime validation uses Zod. Contract/runtime parity is covered by API integration tests and remains a release gate as the API grows.

## GET `/rates`

```http
GET /v1/hu/vat/rates?effectiveDate=2026-09-01
```

Returns the supported Hungarian VAT rate catalogue: 0%, 5%, 18%, 27%, plus source metadata and the verification date. A rate existing in the catalogue does **not** mean every product can use that rate.

## POST `/classify-rate`

Supported deterministic subsets currently include:

- qualifying daily newspapers at 0%;
- qualifying prescription/human magistral medicines at 0% from 2026-09-01;
- selected 18% product groups with VTSZ plus statutory-description confirmation;
- selected 2026 5% domesticated-cattle products;
- caller-confirmed rates for arithmetic-only downstream use.

Example 18% request:

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

A matching VTSZ alone is not treated as sufficient where the statute also imposes a textual product description.

## POST `/exemptions/activity`

Evaluates bounded activity-specific exemptions under Áfa tv. 85–86. §.

Currently supported input kinds:

- `human_healthcare`;
- `dental`;
- `education`;
- `insurance`;
- `credit`;
- `payment_financial`.

Example healthcare request:

```json
{
  "effectiveDate": "2026-09-01",
  "kind": "human_healthcare",
  "serviceIsHumanHealthcare": true,
  "providerActsInHealthcareCapacity": true,
  "permitRequired": true,
  "permitHeld": true,
  "qualificationRequired": true,
  "qualifiedPersonAvailable": true
}
```

Example result:

```json
{
  "rulesetId": "HU-VAT-2026-006",
  "effectiveDate": "2026-09-01",
  "status": "exempt",
  "exemptionCode": "HU_85_1_C_HEALTHCARE",
  "exemptionNature": "public_interest",
  "legalBasis": "Áfa tv. 85. § (1) c), (3)"
}
```

The regulated-activity guard is explicit: if a permit or qualified natural person is legally required, the caller must confirm the relevant condition.

For the supported financial path, debt collection and portfolio management are explicitly prevented from being classified as exempt through the payment/financial rule.

Possible status values:

- `exempt` — the supplied facts satisfy the supported exemption;
- `not_exempt_under_supported_rule` — this specific exemption does not apply;
- `manual_review` — the supplied facts do not prove a deterministic result.

**Important:** `not_exempt_under_supported_rule` does not mean “27%”. The API does not infer a fallback rate or rule out a different exemption/treatment.

## POST `/exemptions/property-rental`

Evaluates the activity-specific Hungarian property-rental treatment under Áfa tv. 86. § (1) l), 86. § (2) and 88. §.

Ordinary rental without an applicable taxation election:

```json
{
  "effectiveDate": "2026-09-01",
  "rentalKind": "ordinary",
  "propertyResidential": true,
  "taxableElectionScope": "none",
  "taxableElectionDeclaredAndEffective": false
}
```

This returns `status: "exempt"` under the supported activity-specific rule.

`rentalKind` also models the statutory §86 (2) exceptions:

- `commercial_accommodation`;
- `vehicle_parking`;
- `permanently_attached_equipment`;
- `safe`.

Those return `not_exempt_under_supported_rule` because they are expressly excluded from the ordinary property-rental exemption.

The evaluator also supports a confirmed §88 taxation election:

- `all_property_rentals`;
- `non_residential_only`.

A confirmed non-residential-only election applies to ordinary non-residential rental while ordinary residential rental remains within the activity-specific exemption. If an election is claimed but its declaration/effectiveness is not confirmed, the result is `manual_review`.

AAM remains a **separate taxpayer-level overlay** and is not silently mixed into this result.

## POST `/exemptions/property-sale`

Evaluates property-sale exemption or statutory taxability under Áfa tv. 86. § (1) j)–k) and a confirmed taxation election under 88. §.

Old built-property example:

```json
{
  "effectiveDate": "2026-09-01",
  "propertyKind": "built",
  "propertyResidential": true,
  "firstOccupancy": {
    "status": "occurred",
    "statutoryEvidenceDate": "2020-01-10"
  },
  "qualifyingUseOrUnitChange": {
    "status": "none"
  },
  "sellerDomesticVatRegistered": true,
  "taxableElectionScope": "none",
  "taxableElectionDeclaredAndEffective": false
}
```

This returns `treatment: "exempt"` and `propertyClassification: "old_built_property"`.

Supported mandatory-taxable paths are:

- `HU_86_1_JA_NEW_PROPERTY_MANDATORY_TAXABLE` — first intended use has not occurred;
- `HU_86_1_JB_NEW_PROPERTY_WITHIN_TWO_YEARS` — the sale precedes the second calendar anniversary of the legally relevant first-occupancy evidence date;
- `HU_86_1_JC_CHANGED_PROPERTY_WITHIN_TWO_YEARS` — a qualifying purpose or independent-unit-count change occurred and the sale precedes the second anniversary of its authority-certificate date;
- `HU_86_1_K_BUILDING_PLOT_MANDATORY_TAXABLE` — undeveloped land is confirmed as a building plot.

The two-year comparison uses calendar anniversaries. On the second anniversary itself, the property is no longer classified by the corresponding “less than two years” path.

For undeveloped property, use:

```json
{
  "effectiveDate": "2026-09-01",
  "propertyKind": "undeveloped",
  "buildingPlot": false,
  "sellerDomesticVatRegistered": true,
  "taxableElectionScope": "all_property_sales",
  "taxableElectionDeclaredAndEffective": true
}
```

The caller is responsible for confirming the statutory building-plot classification. The engine does not infer it from a free-text address or parcel description.

For otherwise exempt old built property or non-building-plot undeveloped property, the supported §88 election scopes are:

- `all_property_sales`;
- `non_residential_only`.

A confirmed applicable election produces `treatment: "taxable_by_election"`. An unconfirmed or internally inconsistent election produces `manual_review`. Rate classification and the person liable for VAT remain separate decisions.

## POST `/exemptions/aam/threshold`

Evaluates the 2026 Hungarian alanyi adómentesség turnover threshold. The caller supplies turnover values already calculated under Áfa tv. 188. §.

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

The 2026 annual threshold is `20000000` HUF.

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

For 2026-07-01 registration, the evaluator uses 184 calendar days and compares against the exact fraction `20,000,000 × 184 / 365`. `thresholdHuf` is a whole-forint display floor only; the legal boundary comparison uses integer cross-products against the exact fraction.

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
  "rulesetId": "HU-VAT-2026-006",
  "netAmount": "100.00",
  "vatAmount": "27.00",
  "grossAmount": "127.00"
}
```

The engine uses integer minor-unit arithmetic and half-up rounding at the caller-selected scale. Invoice-level aggregation, foreign-currency conversion and final production rounding policy are not yet part of this endpoint.

## POST `/tax-point/periodic`

Resolves the supported Áfa tv. 58. § periodic-settlement tax point, including the period-end + 60-day cap. If the resolved date lies after the legally verified window, the request fails closed.

## POST `/reverse-charge/domestic-construction`

Evaluates the currently supported domestic construction scenario under Áfa tv. 142. §. It does not yet cover every reverse-charge category.

## POST `/reverse-charge/property-sale`

Evaluates the domestic reverse-charge path in Áfa tv. 142. § (1) e) for an otherwise exempt §86 (1) j)–k) property sale that the seller made taxable through a confirmed §88 election.

```json
{
  "sale": {
    "effectiveDate": "2026-09-01",
    "propertyKind": "built",
    "propertyResidential": false,
    "firstOccupancy": {
      "status": "occurred",
      "statutoryEvidenceDate": "2020-01-10"
    },
    "qualifyingUseOrUnitChange": {
      "status": "none"
    },
    "sellerDomesticVatRegistered": true,
    "taxableElectionScope": "all_property_sales",
    "taxableElectionDeclaredAndEffective": true
  },
  "recipientDomesticVatRegistered": true,
  "supplierTaxPayableStatus": true,
  "recipientTaxPayableStatus": true
}
```

This returns `status: "reverse_charge"` only when the §88 election applies and both parties satisfy the supported domestic-registration and tax-payability-status checks in §142 (3).

Mandatory-taxable new property and building plots do **not** enter this evaluator's §142 (1) e) reverse-charge path. An exempt sale without an applicable election also returns `not_reverse_charge_under_supported_rule`.

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

Current error codes:

- `invalid_request`;
- `unsupported_effective_date`;
- `classification_failed`;
- `calculation_failed`;
- `tax_point_failed`;
- `reverse_charge_evaluation_failed`;
- `aam_threshold_evaluation_failed`;
- `activity_exemption_evaluation_failed`;
- `property_rental_exemption_evaluation_failed`;
- `property_sale_exemption_evaluation_failed`;
- `property_sale_reverse_charge_evaluation_failed`.

Typical HTTP behavior:

- `400` — malformed or incomplete input;
- `422` — syntactically valid request that cannot be processed under the currently verified rules.

## Compliance boundary

The MVP keeps separate:

1. **classification** — applicable VAT rate/treatment;
2. **activity exemption** — whether a specific §85–86 exemption applies;
3. **taxpayer exemption** — e.g. AAM;
4. **tax point / mechanism** — when and by whom VAT is accounted for;
5. **arithmetic** — exact net/VAT/gross computation.

This separation is intentional: failure of one exemption must never silently become a VAT-rate decision.
