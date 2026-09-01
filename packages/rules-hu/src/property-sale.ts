import { addCalendarYears, assertIsoDate } from './date-utils.js';
import { HUNGARY_VAT_RULESET, assertSupportedDate } from './rates.js';

type PropertySaleTaxableElectionScope = 'none' | 'all_property_sales' | 'non_residential_only';

type PropertySaleCommonInput = {
  effectiveDate: string;
  sellerDomesticVatRegistered: boolean;
  taxableElectionScope: PropertySaleTaxableElectionScope;
  taxableElectionDeclaredAndEffective: boolean;
};

export type PropertySaleExemptionInput = PropertySaleCommonInput & (
  | {
      propertyKind: 'built';
      propertyResidential: boolean;
      firstOccupancy:
        | { status: 'not_occurred' }
        | { status: 'occurred'; statutoryEvidenceDate: string };
      qualifyingUseOrUnitChange:
        | { status: 'none' }
        | { status: 'occurred'; statutoryEvidenceDate: string };
    }
  | {
      propertyKind: 'undeveloped';
      buildingPlot: boolean;
    }
);

export type PropertySaleExemptionResult = {
  rulesetId: string;
  effectiveDate: string;
  status: 'exempt' | 'not_exempt_under_supported_rule' | 'manual_review';
  treatment: 'exempt' | 'mandatory_taxable' | 'taxable_by_election' | 'manual_review';
  treatmentCode: string;
  propertyClassification: 'new_built_property' | 'old_built_property' | 'building_plot' | 'other_undeveloped_property' | 'undetermined';
  taxableElectionApplies: boolean | null;
  legalBasis: string;
  sourceIds: readonly string[];
  reason: string;
  notice: string;
};

const PROPERTY_SALE_SOURCE_IDS = [
  'HU-AFA-TV',
  'NAV-PROPERTY-SALE-2023-8',
  'NAV-PROPERTY-SALE-ELECTION'
] as const;

const NOTICE = 'This evaluator determines only the property-sale exemption or statutory taxability under Áfa tv. 86. § (1) j)–k) and 88. §. It does not infer the VAT rate, reverse-charge mechanism, AAM treatment or other transaction rules.';

function result(
  input: PropertySaleExemptionInput,
  values: Omit<PropertySaleExemptionResult, 'rulesetId' | 'effectiveDate' | 'sourceIds' | 'notice'>
): PropertySaleExemptionResult {
  return {
    rulesetId: HUNGARY_VAT_RULESET.id,
    effectiveDate: input.effectiveDate,
    ...values,
    sourceIds: PROPERTY_SALE_SOURCE_IDS,
    notice: NOTICE
  };
}

function mandatoryTaxable(
  input: PropertySaleExemptionInput,
  treatmentCode: string,
  propertyClassification: PropertySaleExemptionResult['propertyClassification'],
  legalBasis: string,
  reason: string
): PropertySaleExemptionResult {
  return result(input, {
    status: 'not_exempt_under_supported_rule',
    treatment: 'mandatory_taxable',
    treatmentCode,
    propertyClassification,
    taxableElectionApplies: false,
    legalBasis,
    reason
  });
}

function manualReview(
  input: PropertySaleExemptionInput,
  treatmentCode: string,
  propertyClassification: PropertySaleExemptionResult['propertyClassification'],
  legalBasis: string,
  reason: string
): PropertySaleExemptionResult {
  return result(input, {
    status: 'manual_review',
    treatment: 'manual_review',
    treatmentCode,
    propertyClassification,
    taxableElectionApplies: null,
    legalBasis,
    reason
  });
}

function validateEvidenceDate(effectiveDate: string, evidenceDate: string, field: string): void {
  assertIsoDate(evidenceDate);
  if (evidenceDate > effectiveDate) {
    throw new Error(`${field} cannot be later than effectiveDate.`);
  }
}

function withinTwoCalendarYears(effectiveDate: string, evidenceDate: string): boolean {
  return effectiveDate < addCalendarYears(evidenceDate, 2);
}

function applyTaxableElection(
  input: PropertySaleExemptionInput,
  propertyResidential: boolean,
  propertyClassification: 'old_built_property' | 'other_undeveloped_property',
  exemptionCode: string,
  exemptionLegalBasis: string,
  exemptionReason: string
): PropertySaleExemptionResult {
  if (input.taxableElectionScope === 'none' && input.taxableElectionDeclaredAndEffective) {
    return manualReview(
      input,
      'HU_88_PROPERTY_SALE_ELECTION_INCONSISTENT',
      propertyClassification,
      'Áfa tv. 88. § (1), (3)–(6)',
      'The request says a taxation election is effective but supplies no election scope.'
    );
  }

  if (input.taxableElectionScope !== 'none' && !input.taxableElectionDeclaredAndEffective) {
    return manualReview(
      input,
      'HU_88_PROPERTY_SALE_ELECTION_UNCONFIRMED',
      propertyClassification,
      'Áfa tv. 88. § (1), (3)–(6)',
      'A taxation-election scope was supplied, but its valid declaration and effectiveness have not been confirmed.'
    );
  }

  if (input.taxableElectionScope !== 'none' && !input.sellerDomesticVatRegistered) {
    return manualReview(
      input,
      'HU_88_PROPERTY_SALE_SELLER_STATUS_UNCONFIRMED',
      propertyClassification,
      'Áfa tv. 88. § (1)',
      'The §88 election is available to a domestically registered taxable person, but that seller status has not been confirmed.'
    );
  }

  const electionApplies = input.taxableElectionDeclaredAndEffective && (
    input.taxableElectionScope === 'all_property_sales' ||
    (input.taxableElectionScope === 'non_residential_only' && !propertyResidential)
  );

  if (electionApplies) {
    return result(input, {
      status: 'not_exempt_under_supported_rule',
      treatment: 'taxable_by_election',
      treatmentCode: 'HU_88_PROPERTY_SALE_TAXABLE_ELECTION',
      propertyClassification,
      taxableElectionApplies: true,
      legalBasis: 'Áfa tv. 88. § (1) a), (2)–(6)',
      reason: 'The otherwise exempt property sale is covered by a confirmed effective election to make the activity taxable.'
    });
  }

  return result(input, {
    status: 'exempt',
    treatment: 'exempt',
    treatmentCode: exemptionCode,
    propertyClassification,
    taxableElectionApplies: false,
    legalBasis: exemptionLegalBasis,
    reason: input.taxableElectionScope === 'non_residential_only' && propertyResidential
      ? 'The confirmed election applies only to non-residential property; this residential-property sale remains exempt under the supported activity-specific rule.'
      : exemptionReason
  });
}

export function evaluatePropertySaleExemption(input: PropertySaleExemptionInput): PropertySaleExemptionResult {
  assertSupportedDate(input.effectiveDate);

  if (input.propertyKind === 'undeveloped') {
    if (input.buildingPlot) {
      return mandatoryTaxable(
        input,
        'HU_86_1_K_BUILDING_PLOT_MANDATORY_TAXABLE',
        'building_plot',
        'Áfa tv. 86. § (1) k)',
        'A building plot is expressly excluded from the undeveloped-property exemption and is therefore mandatorily taxable under this supported rule.'
      );
    }

    return applyTaxableElection(
      input,
      false,
      'other_undeveloped_property',
      'HU_86_1_K_OTHER_UNDEVELOPED_PROPERTY_EXEMPT',
      'Áfa tv. 86. § (1) k), 88. §',
      'The undeveloped property is confirmed not to be a building plot and no applicable taxable election has been confirmed.'
    );
  }

  if (input.firstOccupancy.status === 'not_occurred') {
    return mandatoryTaxable(
      input,
      'HU_86_1_JA_NEW_PROPERTY_MANDATORY_TAXABLE',
      'new_built_property',
      'Áfa tv. 86. § (1) j) ja)',
      'First intended use has not yet occurred, so the built property is excluded from the exemption as new property.'
    );
  }

  const firstOccupancyEvidenceDate = input.firstOccupancy.statutoryEvidenceDate;
  validateEvidenceDate(input.effectiveDate, firstOccupancyEvidenceDate, 'firstOccupancy.statutoryEvidenceDate');

  if (withinTwoCalendarYears(input.effectiveDate, firstOccupancyEvidenceDate)) {
    return mandatoryTaxable(
      input,
      'HU_86_1_JB_NEW_PROPERTY_WITHIN_TWO_YEARS',
      'new_built_property',
      'Áfa tv. 86. § (1) j) jb)',
      'Less than two calendar years have elapsed between the statutory first-occupancy evidence date and the sale.'
    );
  }

  if (input.qualifyingUseOrUnitChange.status === 'occurred') {
    const changeEvidenceDate = input.qualifyingUseOrUnitChange.statutoryEvidenceDate;
    validateEvidenceDate(input.effectiveDate, changeEvidenceDate, 'qualifyingUseOrUnitChange.statutoryEvidenceDate');

    if (changeEvidenceDate < firstOccupancyEvidenceDate) {
      return manualReview(
        input,
        'HU_86_1_JC_CHANGE_DATE_INCONSISTENT',
        'undetermined',
        'Áfa tv. 86. § (1) j) jc)',
        'The supplied qualifying-change evidence date predates the first-occupancy evidence date and requires manual review.'
      );
    }

    if (withinTwoCalendarYears(input.effectiveDate, changeEvidenceDate)) {
      return mandatoryTaxable(
        input,
        'HU_86_1_JC_CHANGED_PROPERTY_WITHIN_TWO_YEARS',
        'new_built_property',
        'Áfa tv. 86. § (1) j) jc)',
        'The property purpose or number of independent units changed and less than two calendar years have elapsed since the statutory evidence date.'
      );
    }
  }

  return applyTaxableElection(
    input,
    input.propertyResidential,
    'old_built_property',
    'HU_86_1_J_OLD_BUILT_PROPERTY_EXEMPT',
    'Áfa tv. 86. § (1) j), 88. §',
    'At least two calendar years have elapsed since every supplied statutory new-property event, and no applicable taxable election has been confirmed.'
  );
}
