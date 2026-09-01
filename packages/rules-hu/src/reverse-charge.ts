import { HUNGARY_VAT_RULESET, assertSupportedDate } from './rates.js';
import { evaluatePropertySaleExemption } from './property-sale.js';
import type { PropertySaleExemptionInput } from './property-sale.js';

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

export type PropertySaleReverseChargeInput = {
  sale: PropertySaleExemptionInput;
  recipientDomesticVatRegistered: boolean;
  supplierTaxPayableStatus: boolean;
  recipientTaxPayableStatus: boolean;
};

export type PropertySaleReverseChargeResult = {
  rulesetId: string;
  effectiveDate: string;
  status: 'reverse_charge' | 'not_reverse_charge_under_supported_rule' | 'manual_review';
  eligible: boolean | null;
  mechanism: 'domestic_reverse_charge_property_sale';
  propertySaleTreatmentCode: string;
  checks: {
    section88TaxableElectionApplies: boolean;
    supplierDomesticVatRegistered: boolean;
    recipientDomesticVatRegistered: boolean;
    supplierTaxPayableStatus: boolean;
    recipientTaxPayableStatus: boolean;
  };
  failedChecks: string[];
  legalBasis: string;
  sourceIds: readonly string[];
  reason: string;
  notice: string;
};

export function evaluatePropertySaleReverseCharge(input: PropertySaleReverseChargeInput): PropertySaleReverseChargeResult {
  const sale = evaluatePropertySaleExemption(input.sale);
  const checks = {
    section88TaxableElectionApplies: sale.treatment === 'taxable_by_election',
    supplierDomesticVatRegistered: input.sale.sellerDomesticVatRegistered,
    recipientDomesticVatRegistered: input.recipientDomesticVatRegistered,
    supplierTaxPayableStatus: input.supplierTaxPayableStatus,
    recipientTaxPayableStatus: input.recipientTaxPayableStatus
  };
  const failedChecks = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);

  const base = {
    rulesetId: HUNGARY_VAT_RULESET.id,
    effectiveDate: input.sale.effectiveDate,
    mechanism: 'domestic_reverse_charge_property_sale',
    propertySaleTreatmentCode: sale.treatmentCode,
    checks,
    failedChecks,
    legalBasis: 'Áfa tv. 142. § (1) e), (3), (5)–(7)',
    sourceIds: ['HU-AFA-TV', 'NAV-PROPERTY-SALE-REVERSE-CHARGE'],
    notice: 'This evaluator covers only domestic reverse charge for an otherwise exempt §86 (1) j)–k) property sale made taxable by a §88 election. Mandatory-taxable new-property and building-plot sales are outside this reverse-charge path.'
  } as const;

  if (sale.status === 'manual_review') {
    return {
      ...base,
      status: 'manual_review',
      eligible: null,
      reason: `The underlying property-sale treatment requires manual review: ${sale.reason}`
    };
  }

  if (sale.treatment !== 'taxable_by_election') {
    return {
      ...base,
      status: 'not_reverse_charge_under_supported_rule',
      eligible: false,
      reason: sale.treatment === 'mandatory_taxable'
        ? 'The sale is mandatorily taxable as new property or a building plot, not an otherwise exempt §86 (1) j)–k) sale made taxable by election.'
        : 'The sale remains exempt because no applicable §88 taxable election was confirmed.'
    };
  }

  const eligible = Object.values(checks).every(Boolean);
  return {
    ...base,
    status: eligible ? 'reverse_charge' : 'not_reverse_charge_under_supported_rule',
    eligible,
    reason: eligible
      ? 'The §88-elected property sale and both parties satisfy the supported §142 domestic reverse-charge conditions.'
      : 'The property sale is taxable by election, but at least one supported §142 party-status condition is not satisfied.'
  };
}
