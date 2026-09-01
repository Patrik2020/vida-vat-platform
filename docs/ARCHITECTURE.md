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

Future packages should be added by capability, for example:

- `packages/domain`
- `packages/rules-eu`
- `packages/rules-de`
- `packages/rules-at`
- `packages/invoice-model`
- `packages/drr`
- `packages/source-registry`

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
