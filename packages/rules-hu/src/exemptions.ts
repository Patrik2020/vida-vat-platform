import { HUNGARY_VAT_RULESET, assertSupportedDate } from './rates.js';

export type ActivityExemptionInput =
  | {
      effectiveDate: string;
      kind: 'human_healthcare';
      serviceIsHumanHealthcare: boolean;
      providerActsInHealthcareCapacity: boolean;
      permitRequired: boolean;
      permitHeld: boolean;
      qualificationRequired: boolean;
      qualifiedPersonAvailable: boolean;
    }
  | {
      effectiveDate: string;
      kind: 'dental';
      supply: 'dental_service' | 'dental_prosthesis';
      providerActsInDentalCapacity: boolean;
      permitRequired: boolean;
      permitHeld: boolean;
      qualificationRequired: boolean;
      qualifiedPersonAvailable: boolean;
    }
  | {
      effectiveDate: string;
      kind: 'education';
      context: 'public_education' | 'vocational_training' | 'higher_education' | 'adult_training' | 'language_training' | 'recognized_language_exam' | 'study_competition' | 'other';
      providerActsInTeachingCapacity: boolean;
      permitRequired: boolean;
      permitHeld: boolean;
      qualificationRequired: boolean;
      qualifiedPersonAvailable: boolean;
    }
  | {
      effectiveDate: string;
      kind: 'insurance';
      service: 'insurance' | 'reinsurance' | 'brokerage' | 'intermediation';
      actingInRelevantCapacity: boolean;
    }
  | {
      effectiveDate: string;
      kind: 'credit';
      service: 'credit_provision' | 'credit_intermediation' | 'creditor_management';
      actingInRelevantCapacity: boolean;
    }
  | {
      effectiveDate: string;
      kind: 'payment_financial';
      service: 'current_account' | 'deposit_account' | 'customer_account' | 'payment' | 'transfer' | 'cheque' | 'receivable' | 'financial_instrument' | 'intermediation';
      actingInRelevantCapacity: boolean;
      debtCollection: boolean;
      portfolioManagement: boolean;
    };

type ActivityExemptionResult = {
  rulesetId: string;
  effectiveDate: string;
  status: 'exempt' | 'not_exempt_under_supported_rule' | 'manual_review';
  exemptionCode?: string;
  exemptionNature?: 'public_interest' | 'specific_nature';
  legalBasis: string;
  sourceIds: string[];
  reason: string;
  notice: string;
};

function guardRegulatedActivity(input: {
  permitRequired: boolean;
  permitHeld: boolean;
  qualificationRequired: boolean;
  qualifiedPersonAvailable: boolean;
}): string | null {
  if (input.permitRequired && !input.permitHeld) return 'A legally required activity permit has not been confirmed.';
  if (input.qualificationRequired && !input.qualifiedPersonAvailable) return 'A legally required qualified natural person has not been confirmed.';
  return null;
}

function result(
  effectiveDate: string,
  status: ActivityExemptionResult['status'],
  legalBasis: string,
  sourceIds: string[],
  reason: string,
  extra: Pick<ActivityExemptionResult, 'exemptionCode' | 'exemptionNature'> = {}
): ActivityExemptionResult {
  return {
    rulesetId: HUNGARY_VAT_RULESET.id,
    effectiveDate,
    status,
    ...extra,
    legalBasis,
    sourceIds,
    reason,
    notice: 'This evaluator only decides the explicitly modelled activity-specific exemption. It does not infer another exemption or a fallback VAT rate when this rule does not apply.'
  };
}

export function evaluateActivityExemption(input: ActivityExemptionInput): ActivityExemptionResult {
  assertSupportedDate(input.effectiveDate);

  if (input.kind === 'human_healthcare') {
    if (!input.serviceIsHumanHealthcare || !input.providerActsInHealthcareCapacity) {
      return result(input.effectiveDate, 'manual_review', 'Áfa tv. 85. § (1) c), (3)', ['HU-AFA-TV'], 'The supplied facts do not prove that the service is human healthcare performed by a healthcare/naturopathy provider in that capacity.');
    }
    const guardFailure = guardRegulatedActivity(input);
    if (guardFailure) return result(input.effectiveDate, 'not_exempt_under_supported_rule', 'Áfa tv. 85. § (1) c), (3)', ['HU-AFA-TV'], guardFailure);
    return result(input.effectiveDate, 'exempt', 'Áfa tv. 85. § (1) c), (3)', ['HU-AFA-TV'], 'The supplied facts satisfy the supported human-healthcare exemption conditions.', { exemptionCode: 'HU_85_1_C_HEALTHCARE', exemptionNature: 'public_interest' });
  }

  if (input.kind === 'dental') {
    if (!input.providerActsInDentalCapacity) {
      return result(input.effectiveDate, 'manual_review', 'Áfa tv. 85. § (1) e), (3)', ['HU-AFA-TV'], 'The provider has not been confirmed as acting in a human dental/dental-technician capacity.');
    }
    const guardFailure = guardRegulatedActivity(input);
    if (guardFailure) return result(input.effectiveDate, 'not_exempt_under_supported_rule', 'Áfa tv. 85. § (1) e), (3)', ['HU-AFA-TV'], guardFailure);
    return result(input.effectiveDate, 'exempt', 'Áfa tv. 85. § (1) e), (3)', ['HU-AFA-TV'], input.supply === 'dental_prosthesis' ? 'Dental prosthesis supply by a qualifying dental/dental-technician provider is within the supported exemption.' : 'Dental service by a qualifying provider is within the supported exemption.', { exemptionCode: input.supply === 'dental_prosthesis' ? 'HU_85_1_E_DENTAL_PROSTHESIS' : 'HU_85_1_E_DENTAL_SERVICE', exemptionNature: 'public_interest' });
  }

  if (input.kind === 'education') {
    if (input.context === 'other' || !input.providerActsInTeachingCapacity) {
      return result(input.effectiveDate, 'manual_review', 'Áfa tv. 85. § (1) i)–j), (2)–(3)', ['HU-AFA-TV'], 'The supplied education context/capacity does not prove a supported statutory education exemption.');
    }
    const guardFailure = guardRegulatedActivity(input);
    if (guardFailure) return result(input.effectiveDate, 'not_exempt_under_supported_rule', 'Áfa tv. 85. § (1) i)–j), (2)–(3)', ['HU-AFA-TV'], guardFailure);
    return result(input.effectiveDate, 'exempt', 'Áfa tv. 85. § (1) i)–j), (2)–(3)', ['HU-AFA-TV'], 'The supplied facts place the teaching/education service in a supported statutory education context.', { exemptionCode: 'HU_85_EDUCATION_SUPPORTED', exemptionNature: 'public_interest' });
  }

  if (input.kind === 'insurance') {
    if (!input.actingInRelevantCapacity) {
      return result(input.effectiveDate, 'manual_review', 'Áfa tv. 86. § (1) a)', ['HU-AFA-TV'], 'Insurance, reinsurance, brokerage and intermediation are exempt only when supplied in the relevant statutory capacity.');
    }
    return result(input.effectiveDate, 'exempt', 'Áfa tv. 86. § (1) a)', ['HU-AFA-TV'], 'The supplied insurance/reinsurance/intermediary service is within the supported exemption.', { exemptionCode: `HU_86_1_A_${input.service.toUpperCase()}`, exemptionNature: 'specific_nature' });
  }

  if (input.kind === 'credit') {
    if (!input.actingInRelevantCapacity) {
      return result(input.effectiveDate, 'manual_review', 'Áfa tv. 86. § (1) b)', ['HU-AFA-TV'], 'The role required for the supported credit exemption has not been confirmed.');
    }
    return result(input.effectiveDate, 'exempt', 'Áfa tv. 86. § (1) b)', ['HU-AFA-TV'], 'The supplied credit/loan service is within the supported exemption.', { exemptionCode: `HU_86_1_B_${input.service.toUpperCase()}`, exemptionNature: 'specific_nature' });
  }

  if (input.debtCollection) {
    return result(input.effectiveDate, 'not_exempt_under_supported_rule', 'Áfa tv. 86. § (1) d)', ['HU-AFA-TV'], 'Debt collection is expressly excluded from the supported payment/receivable exemption.');
  }
  if (input.portfolioManagement) {
    return result(input.effectiveDate, 'not_exempt_under_supported_rule', 'Áfa tv. 86. § (3)', ['HU-AFA-TV'], 'Portfolio management is expressly excluded from the §86 (1) d) and f) exemptions.');
  }
  if (!input.actingInRelevantCapacity) {
    return result(input.effectiveDate, 'manual_review', 'Áfa tv. 86. § (1) d), (3)', ['HU-AFA-TV'], 'The supplied facts do not prove that the service is being performed in the relevant payment/financial capacity.');
  }
  return result(input.effectiveDate, 'exempt', 'Áfa tv. 86. § (1) d), (3)', ['HU-AFA-TV'], 'The supplied account/payment/transfer/financial service is within the supported exemption and is not debt collection or portfolio management.', { exemptionCode: `HU_86_1_D_${input.service.toUpperCase()}`, exemptionNature: 'specific_nature' });
}
