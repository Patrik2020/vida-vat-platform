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

## Initial scope

Phase 1 is a Hungary VAT rules API with:

- explicit effective-date handling;
- versioned tax rules;
- traceable rule/source metadata;
- deterministic API behavior;
- automated tests;
- an architecture designed for additional EU Member States.

The first ruleset exposes the currently verified Hungarian VAT rates (27%, 18%, 5%) and their legal-source metadata. Automatic product/service classification and tax calculation are deliberately deferred until their rule and rounding models are fully specified and tested.

## Repository structure

```text
apps/
  api/                  Fastify HTTP API
packages/
  rules-hu/             Hungary VAT rules

docs/
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

Initial endpoints:

- `GET /health`
- `GET /v1/hu/vat/rates?effectiveDate=2026-09-01`

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

Early foundation / architecture phase.
