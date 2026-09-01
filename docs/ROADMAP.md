# Roadmap

## Phase 0 — Foundation — complete

- monorepo and API skeleton;
- Hungary rules package;
- source traceability model;
- effective-date guardrails;
- CI, type checks and tests;
- architecture and regulatory-source documentation.

## Phase 1 — Hungary VAT API MVP — in progress

### Implemented

- richer Hungarian VAT rate model including 0%, 5%, 18% and 27%;
- authoritative-source registry for coded rules;
- partial fail-closed rate classification;
- first deterministic 0% product classifications;
- transaction treatment foundation (`taxable`, `exempt`, `reverse_charge`);
- exact decimal VAT calculation from net or gross values;
- periodic-settlement tax-point resolution under Áfa tv. 58. §;
- domestic construction reverse-charge evaluator;
- 2026 AAM annual 20,000,000 HUF threshold evaluator;
- Áfa tv. 189. § time-proportional AAM evaluator for taxpayers registered during 2026, with exact rational boundary comparison;
- stable versioned API error envelope with request IDs;
- machine-readable OpenAPI contract and Swagger UI;
- automated authoritative-source regulatory monitoring with a separate audit-state branch;
- Fastify integration tests and rules-engine tests;
- current API usage and regulatory-source documentation.

### Remaining Phase 1 work

- broaden authoritative classification mappings for 5% and 18% rates;
- expand formal exemption models beyond the AAM threshold foundation, beginning with commercially relevant Hungarian cases;
- deepen reverse-charge coverage beyond the supported construction scenario;
- research and formalise invoice-level rounding/aggregation and currency rules;
- expand response schemas/examples in the OpenAPI contract as business models stabilise;
- expanded fixtures based on official NAV examples;
- advance the verified-through window through reviewed regulatory refreshes without weakening fail-closed behavior.

## Phase 2 — Hungary compliance engine

- domestic B2B/B2C scenarios;
- intra-Community supplies and acquisitions;
- imports/exports foundations;
- invoice data requirements;
- Hungarian online invoice/reporting integration research;
- audit trail and rule explanation output.

## Phase 3 — EU core

- shared EU VAT transaction model;
- place-of-supply rules;
- OSS/IOSS/SVR concepts;
- VAT ID validation abstraction;
- first additional Member State modules;
- cross-border scenario test matrix.

## Phase 4 — ViDA implementation

- structured e-invoice domain model;
- Digital Reporting Requirements model;
- cross-border B2B reporting workflows;
- implementation adapters aligned with EU technical specifications as they stabilise;
- 2030 readiness test suite.

## Phase 5 — Commercial platform

- tenant accounts;
- API keys and scoped permissions;
- usage metering and quotas;
- rate limiting;
- billing/subscriptions;
- customer dashboard;
- webhooks;
- SLA/observability/audit capabilities.

## Strategic dates

- **2027-01-01** — OSS/IOSS clarifications.
- **2028-07-01** — major SVR/platform changes.
- **2030-07-01** — cross-border B2B DRR/e-invoicing milestone.
- **2035-01-01** — alignment deadline for relevant domestic digital reporting systems.

The roadmap is intentionally modular: implementation priority should follow confirmed law, technical specifications, customer demand and commercial opportunity rather than attempting all 27 Member States at once.
