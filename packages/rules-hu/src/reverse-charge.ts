import { HUNGARY_VAT_RULESET, assertSupportedDate } from './rates.js';

export type DomesticConstructionReverseChargeInput = {
  effectiveDate: string;
  supplierDomesticVatRegistered: boolean;
  recipientDomesticVatRegistered: boolean;
  supplierTaxPayableStatus: boolean;
  recipientTaxPayableStatus: boolean;
  constructionAssemblyWork: boolean;
  propertyActivity: 'create' | 'expand' | 'transform' | 'demolish' | 'change_purpose' | 'other';
  authorityPermitOrNotificationRequired: boolean;
  requiredDeclarationProvided: boolean;
};

export function evaluateDomesticConstructionReverseCharge(input: DomesticConstructionReverseChargeInput) {
  assertSupportedDate(input.effectiveDate);

  const checks = {
    supplierDomesticVatRegistered: input.supplierDomesticVatRegistered,
    recipientDomesticVatRegistered: input.recipientDomesticVatRegistered,
    supplierTaxPayableStatus: input.supplierTaxPayableStatus,
    recipientTaxPayableStatus: input.recipientTaxPayableStatus,
    constructionAssemblyWork: input.constructionAssemblyWork,
    qualifyingPropertyActivity: input.propertyActivity !== 'other',
    authorityPermitOrNotificationRequired: input.authorityPermitOrNotificationRequired,
    requiredDeclarationProvided: input.requiredDeclarationProvided
  };

  const eligible = Object.values(checks).every(Boolean);
  const failedChecks = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);

  return {
    rulesetId: HUNGARY_VAT_RULESET.id,
    effectiveDate: input.effectiveDate,
    mechanism: 'domestic_reverse_charge_construction',
    eligible,
    failedChecks,
    legalBasis: 'Áfa tv. 142. § (1) b), valamint a 142. § további személyi feltételei',
    sourceIds: ['HU-AFA-TV', 'NAV-REVERSE-CONSTRUCTION-2026'],
    notice: eligible
      ? 'The supplied facts satisfy this MVP evaluator for domestic construction reverse charge.'
      : 'Do not apply reverse charge from this evaluator unless every required condition is satisfied.'
  };
}
