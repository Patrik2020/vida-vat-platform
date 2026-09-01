# Regulatory Monitor

The regulatory monitor watches authoritative Hungarian and EU VAT/ViDA sources without granting those sources the ability to modify production tax rules.

## Safety model

The flow is deliberately one-way:

`official source -> observation -> normalized hash/diff -> GitHub issue -> human review -> tested PR -> ruleset`

A detected webpage or legal-text change **never updates `main`, a VAT rate, an exemption, an effective date or a production ruleset automatically**.

## Watched sources

The initial monitor covers:

- Nemzeti Jogszabálytár — 2007. évi CXXVII. törvény (Áfa tv.);
- NAV — Általános forgalmi adó discovery page;
- NAV — 2026 information booklets discovery page;
- European Commission DG TAXUD — ViDA overview/implementation page;
- EUR-Lex — Directive (EU) 2025/516;
- EUR-Lex — Regulation (EU) 2025/517;
- EUR-Lex — Implementing Regulation (EU) 2025/518.

The source manifest lives in `packages/regulatory-monitor/src/sources.ts`.

## Observation history

The scheduled workflow maintains a separate `regulatory-state` branch. Its `.regulatory-state/` directory contains the last successfully observed normalized content and metadata for every source.

This branch is an observation/audit log, **not an approved legal rules branch**. The first successful observation of a new source is treated as a bootstrap and does not create a regulatory-change issue.

## Change detection

For HTML pages the monitor removes scripts, styles, comments and markup, normalizes Unicode and whitespace, then computes SHA-256 over the resulting text. Every source also has minimum-size and required-content guardrails so a login page, bot challenge or broken redirect is not silently accepted as a legal update.

When the normalized hash changes, the monitor:

1. compares the new observation to the previous one;
2. creates a capped added/removed line excerpt;
3. opens a `regulatory-change` + `regulatory-review` GitHub issue;
4. records the new observation on `regulatory-state`;
5. leaves all production rules untouched.

The issue contains a checklist requiring the reviewer to read the authoritative source, determine affected rules, identify effective/transitional dates, update source metadata and add regression tests before any ruleset PR is merged.

## Source failures

If a watched source cannot be fetched or fails its content guardrails, the previous observation is kept. A deduplicated `regulatory-monitor` issue is opened instead of treating the failure page as new law.

## Schedule

GitHub Actions runs the monitor daily at `03:17 UTC` and it can also be run manually with `workflow_dispatch`. The non-round minute reduces the chance of GitHub's scheduled-job congestion.

## Known limitation

Hash-based monitoring detects that authoritative content changed; it does not prove the legal significance of that change. Template/navigation changes can therefore produce a review issue. This is intentional at the current stage: false-positive review work is safer than silently missing a VAT rule change.

A later phase can add source-specific semantic extraction and an AI-assisted impact classifier, but AI output must remain advisory and must never be treated as a legal source or automatic production approval.
