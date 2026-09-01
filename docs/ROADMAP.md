# Roadmap

## Phase 0 — Foundation (current)

- monorepo and API skeleton;
- Hungary rules package;
- source traceability model;
- effective-date guardrails;
- CI, type checks and tests;
- architecture and regulatory-source documentation.

## Phase 1 — Hungary VAT API MVP

- richer Hungarian VAT rate/category model;
- authoritative classification mapping for reduced rates;
- transaction taxonomy;
- VAT exemption and reverse-charge rule foundations;
- currency/rounding policy researched and implemented;
- deterministic VAT calculation endpoints;
- OpenAPI documentation;
- API error contract;
- expanded test fixtures based on official examples.

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
