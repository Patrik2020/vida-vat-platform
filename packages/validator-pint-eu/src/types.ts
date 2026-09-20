export type PintEuDocumentType = 'Invoice' | 'CreditNote';

export type PintEuFinding = {
  severity: 'fatal' | 'warning';
  ruleId: string;
  layer: 'xml' | 'ubl-2.1' | 'pint-eu' | 'code-list' | 'capability';
  message: string;
  path?: string;
};

export type PintEuArtifactManifest = {
  validatorVersion: string;
  profile: { id: 'PINT-EU-Billing'; version: '1.1.1'; releaseDate: '2026-06-09'; status: 'final' };
  baseProfile: { id: 'PINT-General'; version: '1.1.3' };
  semanticStandard: { id: 'EN-16931'; edition: '2017'; note: string };
  syntax: { id: 'UBL'; version: '2.1' };
  schematron: { version: 'PINT-EU-1.1.1'; execution: 'external-required'; resourceUrl: string };
  codeLists: { snapshot: 'PINT-EU-1.1.1-2026-06-09'; resourceUrl: string };
  specificationUrl: string;
  releaseNotesUrl: string;
};

export type PintEuValidationResult = {
  status: 'prototype_pass' | 'prototype_fail';
  /** A prototype pass is never evidence of full XSD/Schematron conformance. */
  productionConformance: 'not_assessed';
  documentType?: PintEuDocumentType;
  manifest: PintEuArtifactManifest;
  contentHash: string;
  executedRuleIds: string[];
  findings: PintEuFinding[];
};
