# Architecture

## Design goals

The platform is built around four constraints:

1. **Effective-date correctness** — requests must resolve against a ruleset valid and verified for the requested date.
2. **Source traceability** — every compliance rule must point to authoritative source metadata.
3. **Jurisdiction isolation** — country-specific rules live in separate modules instead of a single global conditional tree.
4. **Progressive ViDA readiness** — invoice/reporting infrastructure can be added without coupling it to basic VAT-rate lookup logic.

## Planned layers

```text
HTTP/API layer
    ↓
Compliance orchestration
    ↓
Jurisdiction rules packages
    ↓
Versioned rule/source registry
    ↓
Future reporting/e-invoicing adapters
```

## Initial workspace

- `apps/api` — Fastify HTTP boundary and validation.
- `packages/rules-hu` — Hungarian VAT ruleset and source metadata.
- `packages/invoice-model` — versioned EN 16931:2026-based, syntax-neutral canonical invoice contract and invariant validation.
- `packages/adapter-osa` — versioned, fail-closed OSA 3.0 XML input adapter with field-level mapping evidence.
- `packages/validator-pint-eu` — PINT-EU Billing 1.1.1 / UBL 2.1 validation prototype with separately pinned syntax, Schematron and code-list versions.

The Hungary package also contains two deliberately separate arithmetic boundaries:

- currency conversion resolves the statutory date/source first, then performs exact rational conversion from caller-supplied documentary rate evidence;
- invoice aggregation calculates both line-rounded and VAT-rate-summary-rounded outcomes and records which caller-selected policy produced the reported total.

Neither boundary silently fetches or invents regulatory evidence, and a rounding policy is not represented as a statutory classification.

Future packages should be added by capability, for example:

- `packages/domain`
- `packages/rules-eu`
- `packages/rules-de`
- `packages/rules-at`
- `packages/drr`
- `packages/source-registry`

The canonical invoice model is deliberately independent from transport syntaxes. OSA XML, PINT-EU/UBL and future HU-ViDA payloads belong in separately versioned adapters that transform into this model and record their version and source evidence in `provenance`. The OSA adapter implements the first such boundary and returns `manual_review` whenever reporting data is incomplete or lacks an EN 16931 semantic equivalent.

The PINT-EU validator is a separate ingress gate rather than domain logic. Its first prototype executes a bounded, named subset of PINT-EU/EN 16931 rules and code-list deltas, records the exact artifact manifest and payload hash, and always reports full production conformance as `not_assessed`. Production acceptance must add execution of the pinned official UBL XSD and complete Schematron bundle; a prototype pass must never be promoted to a Peppol-conformance claim.

## Rule lifecycle

Regulatory data must not be silently overwritten. A changed law creates a new ruleset or rule version with a new effective period. Historical rules remain reproducible.

A future rules registry should record at least:

- rule/ruleset ID;
- jurisdiction;
- effective from/to;
- publication/source date;
- last verified date;
- source URL and authority;
- superseded-by relation;
- test references.

## Fail-closed behavior

For compliance-sensitive requests, the system should fail rather than guess when:

- no ruleset covers the requested date;
- the requested date is later than the latest verified legal snapshot;
- required classification data is unavailable;
- a jurisdiction or transaction type is unsupported.

This is deliberate: an explicit unsupported result is safer than a plausible but unverified tax answer.
