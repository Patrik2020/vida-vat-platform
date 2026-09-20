# PINT-EU validation prototype

`@vida/validator-pint-eu` is an ingress validator prototype for PINT-EU Billing 1.1.1 documents using UBL 2.1 syntax.

## Version contract

The exported manifest pins these dimensions separately:

- PINT-EU Billing `1.1.1`, final release dated 2026-06-09;
- PINT General `1.1.3`;
- UBL `2.1` syntax;
- PINT-EU `1.1.1` Schematron resource bundle;
- code-list snapshot `PINT-EU-1.1.1-2026-06-09`.

This matters because a code-list or Schematron update must not silently mutate the invoice domain model or historical validation evidence.

## Current capability boundary

The prototype securely parses UBL Invoice and CreditNote roots, rejects unsafe XML declarations, checks namespaces, executes a bounded set of named PINT/EN 16931 rules and applies version-specific code-list deltas. Results contain the payload SHA-256, executed rule IDs, findings and the full artifact manifest.

A `prototype_pass` is not a Peppol or EN 16931 conformance certificate. Every result sets `productionConformance` to `not_assessed` and emits a capability warning. Before production acceptance, integrate and pin:

1. complete official UBL 2.1 XSD validation;
2. the full official PINT-EU 1.1.1 Schematron bundle;
3. complete upstream code lists and their checksums;
4. golden fixtures from the official validation package.

## Sources

- [PINT-EU Billing 1.1.1 specification](https://docs.peppol.eu/poac/eu/pint-eu/)
- [PINT-EU 1.1.1 release notes](https://docs.peppol.eu/poac/eu/pint-eu/specialized-release-notes/)
- [PINT-EU downloadable resources](https://docs.peppol.eu/poac/eu/pint-eu/resources.zip)
- [OASIS UBL 2.1](https://docs.oasis-open.org/ubl/os-UBL-2.1/UBL-2.1.html)

The PINT-EU page currently declares the profile a CIUS of EN 16931-1:2017. The repository canonical model's EN 16931:2026 migration path therefore remains separately versioned instead of being inferred from this validator profile.
