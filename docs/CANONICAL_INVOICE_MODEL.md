# Canonical invoice model

`@vida/invoice-model` is the internal, syntax-neutral invoice boundary for the platform. It is aligned to EN 16931:2026 concepts but intentionally does not mirror OSA XML, UBL XML or a future Hungarian ViDA schema one-to-one.

## Version identity

Every document carries two independent versions:

- `schemaVersion` identifies the platform's canonical contract;
- `semanticModel.edition` identifies the EN 16931 baseline.

Adapters must declare their own `adapterVersion` and source schema version in `provenance`. A change to OSA, PINT-EU or a future Hungarian ViDA XSD therefore does not silently change stored canonical documents.

## Adapter boundary

```text
OSA XML ─────────┐
PINT-EU / UBL ───┼─> input adapter ─> CanonicalInvoiceV1 ─> validation / rules / lifecycle
future HU-ViDA ──┘
```

Payload parsing, semantic validation and network transmission remain separate capabilities. An adapter may preserve source-specific fields outside this model, but compliance decisions must be made from explicit canonical facts or return an unsupported/manual-review outcome.

## Audit behavior

The model records transformation time, adapter identity/version, source format, source document ID and an optional content hash. The validator warns when the hash is absent. It never repairs totals: inconsistent line, allowance, charge, tax or payable totals produce stable validation issue codes.

All monetary values use decimal strings. Aggregate checks use exact integer arithmetic and never JavaScript binary floating point.

## Current boundary

This first version provides the stable internal contract and structural/accounting invariants. It is not yet a complete EN 16931 conformance validator or a CIUS implementation. PINT-EU Schematron, code-list versions, OSA mapping and Hungarian ViDA extensions remain separate, versioned packages in later implementation steps.
