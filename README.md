# ViDA VAT Platform

EU VAT compliance infrastructure, starting with a Hungary-first VAT API and designed to evolve into a modular EU VAT rules and ViDA compliance platform.

## Vision

`Hungary VAT API → EU VAT rules engine → EU VAT compliance platform → ViDA-ready infrastructure`

This project is intended as B2B software infrastructure, not as a tax blog or a simple VAT calculator.

## Regulatory baseline

The EU VAT in the Digital Age (ViDA) package was adopted on 11 March 2025 and entered into force on 14 April 2025. It is being rolled out progressively through 2035.

Key milestones relevant to this project:

- **1 January 2027** — OSS/IOSS clarifications.
- **1 July 2028** — major Single VAT Registration measures and platform-economy changes begin.
- **1 July 2030** — Digital Reporting Requirements for cross-border B2B transactions take effect, based on e-invoicing.
- **1 January 2035** — deadline for relevant domestic real-time transaction reporting systems to align with the EU framework.

Primary ViDA legal acts:

- Council Directive (EU) 2025/516
- Council Regulation (EU) 2025/517
- Council Implementing Regulation (EU) 2025/518

## Hungary VAT API — Phase 1 MVP

The current Hungary ruleset is `HU-VAT-2026-003`, verified through **2026-09-01**.

Implemented foundations:

- effective-date and fail-closed regulatory guardrails;
- 0%, 5%, 18% and 27% Hungarian VAT rate catalogue;
- source metadata linked to NJT/NAV material;
- partial, deterministic rate classification;
- 0% qualifying daily-newspaper classification;
- 0% qualifying prescription and human magistral medicine classification from 2026-09-01;
- supported 18% product subsets with both statutory-description and VTSZ checks;
- supported 2026 5% domesticated-cattle product subset with VTSZ and product-condition checks;
- 2026 AAM 20,000,000 HUF threshold evaluator for existing businesses using caller-supplied Áfa tv. 188. § turnover values;
- exact decimal VAT arithmetic from net or gross values;
- taxable, exempt and reverse-charge computational treatments;
- Áfa tv. 58. § periodic-settlement tax-point resolver;
- domestic construction reverse-charge evaluator;
- unit and Fastify integration tests.

### Fail-closed classification

The API does **not** infer a standard 27% rate when facts are insufficient. Unsupported or unproven reduced/zero-rate cases return `manual_review` instead.

This is intentional. Hungarian reduced rates frequently depend on statutory product descriptions, VTSZ/KN classification and transaction-specific facts.

The AAM evaluator is similarly bounded: newly registered businesses currently return `manual_review` because the Áfa tv. 189. § time-proportional threshold logic has not yet been separately modelled.

## Repository structure

```text
apps/
  api/                  Fastify HTTP API
packages/
  rules-hu/             Hungary VAT rules and decision engine

docs/
  API.md
  ARCHITECTURE.md
  ROADMAP.md
  REGULATORY_SOURCES.md
```

## Local development

Requirements: Node.js 22+ and pnpm 10+.

```bash
pnpm install
pnpm build
pnpm test
pnpm dev
```

The API defaults to `http://localhost:3000`.

Current endpoints:

- `GET /health`
- `GET /v1/hu/vat/rates?effectiveDate=2026-09-01`
- `POST /v1/hu/vat/classify-rate`
- `POST /v1/hu/vat/calculate`
- `POST /v1/hu/vat/tax-point/periodic`
- `POST /v1/hu/vat/reverse-charge/domestic-construction`
- `POST /v1/hu/vat/exemptions/aam/threshold`

See `docs/API.md` for request/response examples and current MVP limitations.

## Compliance principle

A rule is not considered production-ready merely because it is coded. Each regulatory rule must have:

1. a stable internal identifier;
2. an effective period;
3. authoritative source metadata;
4. a verification date;
5. automated tests;
6. an explicit supersession path when legislation changes.

The software is infrastructure and does not replace professional tax or legal advice.

## Status

**Phase 1 — Hungary VAT API MVP in active development.**

The deterministic core is functional and now includes first reduced-rate and AAM threshold modules. Remaining Phase 1 work focuses on broader 5%/18% mappings, fuller exemption models, Áfa tv. 189. § new-business AAM handling, API schema/OpenAPI hardening, official-example fixtures and production-grade error/version contracts.
