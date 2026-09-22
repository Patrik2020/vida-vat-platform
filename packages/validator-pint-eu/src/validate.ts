import { createHash } from 'node:crypto';
import { PINT_EU_BILLING_1_1_1 } from './manifest.js';
import { PINT_EU_1_1_1_PROTOTYPE_RULES } from './rules/pint-eu-1.1.1.js';
import type { PintEuFinding, PintEuValidationResult } from './types.js';
import { parsePintEuXml } from './xml.js';

const CAPABILITY_FINDING: PintEuFinding = {
  severity: 'warning',
  ruleId: 'CAPABILITY-FULL-CONFORMANCE',
  layer: 'capability',
  message: 'Prototype checks passed or failed only for the listed rules. Production acceptance still requires the pinned official UBL XSD and complete PINT-EU Schematron bundle.',
};

export function validatePintEuBillingXml(xml: string): PintEuValidationResult {
  const parsed = parsePintEuXml(xml);
  const executedRuleIds: string[] = [];
  const findings = [...parsed.findings];

  if (parsed.root && parsed.documentType && !findings.some((finding) => finding.severity === 'fatal')) {
    for (const rule of PINT_EU_1_1_1_PROTOTYPE_RULES) {
      executedRuleIds.push(rule.id);
      findings.push(...rule.evaluate({ documentType: parsed.documentType, root: parsed.root }));
    }
  }
  findings.push(CAPABILITY_FINDING);

  return {
    status: findings.some((finding) => finding.severity === 'fatal') ? 'prototype_fail' : 'prototype_pass',
    productionConformance: 'not_assessed',
    ...(parsed.documentType ? { documentType: parsed.documentType } : {}),
    manifest: PINT_EU_BILLING_1_1_1,
    contentHash: `sha256:${createHash('sha256').update(xml, 'utf8').digest('hex')}`,
    executedRuleIds,
    findings,
  };
}
