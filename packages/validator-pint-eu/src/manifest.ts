import type { PintEuArtifactManifest } from './types.js';

export const UBL_INVOICE_NAMESPACE = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2';
export const UBL_CREDIT_NOTE_NAMESPACE = 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2';
export const UBL_COMMON_BASIC_NAMESPACE = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';
export const UBL_COMMON_AGGREGATE_NAMESPACE = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';

export const PINT_EU_BILLING_1_1_1: PintEuArtifactManifest = Object.freeze<PintEuArtifactManifest>({
  validatorVersion: '0.1.0',
  profile: { id: 'PINT-EU-Billing', version: '1.1.1', releaseDate: '2026-06-09', status: 'final' },
  baseProfile: { id: 'PINT-General', version: '1.1.3' },
  semanticStandard: {
    id: 'EN-16931',
    edition: '2017',
    note: 'PINT-EU 1.1.1 declares itself a CIUS of EN 16931-1:2017; EN 16931:2026 migration is tracked separately.',
  },
  syntax: { id: 'UBL', version: '2.1' },
  schematron: {
    version: 'PINT-EU-1.1.1',
    execution: 'external-required',
    resourceUrl: 'https://docs.peppol.eu/poac/eu/pint-eu/resources.zip',
  },
  codeLists: {
    snapshot: 'PINT-EU-1.1.1-2026-06-09',
    resourceUrl: 'https://docs.peppol.eu/poac/eu/pint-eu/trn-invoice/codelist/',
  },
  specificationUrl: 'https://docs.peppol.eu/poac/eu/pint-eu/',
  releaseNotesUrl: 'https://docs.peppol.eu/poac/eu/pint-eu/specialized-release-notes/',
});
