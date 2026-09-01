import { HUNGARY_VAT_RULESET, assertSupportedDate } from './rates.js';

export type PropertyRentalExemptionInput = {
  effectiveDate: string;
  rentalKind: 'ordinary' | 'commercial_accommodation' | 'vehicle_parking' | 'permanently_attached_equipment' | 'safe';
  propertyResidential: boolean;
  taxableElectionScope: 'none' | 'all_property_rentals' | 'non_residential_only';
  taxableElectionDeclaredAndEffective: boolean;
};

export type PropertyRentalExemptionResult = {
  rulesetId: string;
  effectiveDate: string;
  status: 'exempt' | 'not_exempt_under_supported_rule' | 'manual_review';
  treatmentCode: string;
  legalBasis: string;
  sourceIds: string[];
  reason: string;
  notice: string;
};

export function evaluatePropertyRentalExemption(input: PropertyRentalExemptionInput): PropertyRentalExemptionResult {
  assertSupportedDate(input.effectiveDate);

  const base = {
    rulesetId: HUNGARY_VAT_RULESET.id,
    effectiveDate: input.effectiveDate,
    sourceIds: ['HU-AFA-TV', 'NAV-PROPERTY-RENTAL-2026'],
    notice: 'This evaluator determines the activity-specific treatment under Áfa tv. 86. § (1) l), 86. § (2) and 88. § only. Personal exemptions such as AAM and other transaction-specific rules must be evaluated separately.'
  } as const;

  if (input.rentalKind !== 'ordinary') {
    const exceptionMap = {
      commercial_accommodation: 'commercial accommodation',
      vehicle_parking: 'vehicle parking/storage',
      permanently_attached_equipment: 'permanently attached machinery/equipment',
      safe: 'safe deposit/safe rental'
    } as const;
    return {
      ...base,
      status: 'not_exempt_under_supported_rule',
      treatmentCode: `HU_86_2_EXCEPTION_${input.rentalKind.toUpperCase()}`,
      legalBasis: 'Áfa tv. 86. § (2)',
      reason: `${exceptionMap[input.rentalKind]} rental is expressly excluded from the §86 (1) l) property-rental exemption.`
    };
  }

  if (input.taxableElectionScope !== 'none' && !input.taxableElectionDeclaredAndEffective) {
    return {
      ...base,
      status: 'manual_review',
      treatmentCode: 'HU_88_ELECTION_UNCONFIRMED',
      legalBasis: 'Áfa tv. 88. § (1), (4)–(6)',
      reason: 'A taxation election was supplied, but its valid declaration/effectiveness has not been confirmed.'
    };
  }

  const electionApplies = input.taxableElectionDeclaredAndEffective && (
    input.taxableElectionScope === 'all_property_rentals' ||
    (input.taxableElectionScope === 'non_residential_only' && !input.propertyResidential)
  );

  if (electionApplies) {
    return {
      ...base,
      status: 'not_exempt_under_supported_rule',
      treatmentCode: 'HU_88_PROPERTY_RENTAL_TAXABLE_ELECTION',
      legalBasis: 'Áfa tv. 88. § (1) b), (4)–(6)',
      reason: 'The otherwise exempt property rental is covered by a confirmed effective election to make the activity taxable.'
    };
  }

  return {
    ...base,
    status: 'exempt',
    treatmentCode: 'HU_86_1_L_PROPERTY_RENTAL_EXEMPT',
    legalBasis: 'Áfa tv. 86. § (1) l), 86. § (2), 88. §',
    reason: input.taxableElectionScope === 'non_residential_only' && input.propertyResidential
      ? 'The confirmed election applies only to non-residential property; this ordinary residential-property rental remains exempt under the activity-specific rule.'
      : 'Ordinary property rental is exempt under the activity-specific rule and no applicable taxable election has been confirmed.'
  };
}
