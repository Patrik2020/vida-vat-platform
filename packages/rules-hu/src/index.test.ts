import { describe, expect, it } from 'vitest';
import {
  HUNGARY_VAT_RULESET,
  aggregateHungaryVatInvoice,
  calculateHungaryVat,
  classifyHungaryVatRate,
  convertHungaryVatAmountToHuf,
  evaluateAamThreshold2026,
  evaluateActivityExemption,
  evaluateDomesticConstructionReverseCharge,
  evaluatePropertySaleExemption,
  evaluatePropertySaleReverseCharge,
  evaluatePropertyRentalExemption,
  getHungaryVatRates,
  resolvePeriodicTaxPoint
} from './index.js';

describe('Hungary VAT Phase 1 rules', () => {
  it('exposes 0, 5, 18 and 27 percent rates for 2026', () => {
    const result = getHungaryVatRates('2026-09-01');
    expect(result.rulesetId).toBe('HU-VAT-2026-007');
    expect(result.rates.map((entry) => entry.rate)).toEqual([27, 18, 5, 0]);
  });

  it('classifies qualifying daily newspapers at 0%', () => {
    const result = classifyHungaryVatRate('2026-08-31', { kind: 'daily_newspaper', customsTariffCode: '4902', issuesPerWeek: 5 });
    expect(result.status).toBe('classified');
    if (result.status === 'classified') expect(result.rate).toBe(0);
  });

  it('classifies qualifying prescription medicine at 0% from 2026-09-01 only', () => {
    const before = classifyHungaryVatRate('2026-08-31', { kind: 'medicine', prescriptionRequired: true, magistral: false, humanUse: true });
    const onDate = classifyHungaryVatRate('2026-09-01', { kind: 'medicine', prescriptionRequired: true, magistral: false, humanUse: true });
    expect(before.status).toBe('manual_review');
    expect(onDate.status).toBe('classified');
    if (onDate.status === 'classified') expect(onDate.rate).toBe(0);
  });

  it('classifies a supported 1904 cereal preparation at 18% only with confirmed statutory description', () => {
    const result = classifyHungaryVatRate('2026-09-01', {
      kind: 'reduced_rate_18_product', category: 'cereal_flour_starch_or_milk_preparation', customsTariffCode: '1904 10 10', statutoryDescriptionConfirmed: true
    });
    expect(result.status).toBe('classified');
    if (result.status === 'classified') expect(result.rate).toBe(18);

    expect(classifyHungaryVatRate('2026-09-01', {
      kind: 'reduced_rate_18_product', category: 'cereal_flour_starch_or_milk_preparation', customsTariffCode: '1904 10 10', statutoryDescriptionConfirmed: false
    }).status).toBe('manual_review');
  });

  it('classifies a supported 2026 domesticated cattle food product at 5%', () => {
    const result = classifyHungaryVatRate('2026-09-01', {
      kind: 'domesticated_cattle_food_product', customsTariffCode: '0201 30 00', domesticatedCattle: true, fitForHumanConsumption: true, preservation: 'chilled'
    });
    expect(result.status).toBe('classified');
    if (result.status === 'classified') expect(result.rate).toBe(5);
  });

  it('does not classify salted cattle products under the supported 5% rule', () => {
    expect(classifyHungaryVatRate('2026-09-01', {
      kind: 'domesticated_cattle_food_product', customsTariffCode: '0201 30 00', domesticatedCattle: true, fitForHumanConsumption: true, preservation: 'salted_or_brined'
    }).status).toBe('manual_review');
  });

  it('classifies supported human-healthcare activity as exempt only with regulatory guards satisfied', () => {
    expect(evaluateActivityExemption({
      effectiveDate: '2026-09-01', kind: 'human_healthcare', serviceIsHumanHealthcare: true, providerActsInHealthcareCapacity: true,
      permitRequired: true, permitHeld: true, qualificationRequired: true, qualifiedPersonAvailable: true
    })).toMatchObject({ rulesetId: 'HU-VAT-2026-007', status: 'exempt', exemptionCode: 'HU_85_1_C_HEALTHCARE' });

    expect(evaluateActivityExemption({
      effectiveDate: '2026-09-01', kind: 'human_healthcare', serviceIsHumanHealthcare: true, providerActsInHealthcareCapacity: true,
      permitRequired: true, permitHeld: false, qualificationRequired: true, qualifiedPersonAvailable: true
    }).status).toBe('not_exempt_under_supported_rule');
  });

  it('classifies supported insurance and credit services as exempt', () => {
    expect(evaluateActivityExemption({
      effectiveDate: '2026-09-01', kind: 'insurance', service: 'brokerage', actingInRelevantCapacity: true
    })).toMatchObject({ status: 'exempt', exemptionNature: 'specific_nature' });
    expect(evaluateActivityExemption({
      effectiveDate: '2026-09-01', kind: 'credit', service: 'credit_intermediation', actingInRelevantCapacity: true
    })).toMatchObject({ status: 'exempt', exemptionNature: 'specific_nature' });
  });

  it('does not treat debt collection or portfolio management as payment-service exemption', () => {
    expect(evaluateActivityExemption({
      effectiveDate: '2026-09-01', kind: 'payment_financial', service: 'receivable', actingInRelevantCapacity: true, debtCollection: true, portfolioManagement: false
    }).status).toBe('not_exempt_under_supported_rule');
    expect(evaluateActivityExemption({
      effectiveDate: '2026-09-01', kind: 'payment_financial', service: 'financial_instrument', actingInRelevantCapacity: true, debtCollection: false, portfolioManagement: true
    }).status).toBe('not_exempt_under_supported_rule');
  });

  it('treats ordinary property rental as activity-exempt when no taxable election applies', () => {
    expect(evaluatePropertyRentalExemption({
      effectiveDate: '2026-09-01', rentalKind: 'ordinary', propertyResidential: true,
      taxableElectionScope: 'none', taxableElectionDeclaredAndEffective: false
    })).toMatchObject({ rulesetId: 'HU-VAT-2026-007', status: 'exempt', treatmentCode: 'HU_86_1_L_PROPERTY_RENTAL_EXEMPT' });
  });

  it('recognises the statutory property-rental exceptions', () => {
    expect(evaluatePropertyRentalExemption({
      effectiveDate: '2026-09-01', rentalKind: 'vehicle_parking', propertyResidential: false,
      taxableElectionScope: 'none', taxableElectionDeclaredAndEffective: false
    })).toMatchObject({ status: 'not_exempt_under_supported_rule', legalBasis: 'Áfa tv. 86. § (2)' });
  });

  it('applies a confirmed non-residential property-rental taxation election only to non-residential property', () => {
    expect(evaluatePropertyRentalExemption({
      effectiveDate: '2026-09-01', rentalKind: 'ordinary', propertyResidential: false,
      taxableElectionScope: 'non_residential_only', taxableElectionDeclaredAndEffective: true
    }).status).toBe('not_exempt_under_supported_rule');
    expect(evaluatePropertyRentalExemption({
      effectiveDate: '2026-09-01', rentalKind: 'ordinary', propertyResidential: true,
      taxableElectionScope: 'non_residential_only', taxableElectionDeclaredAndEffective: true
    }).status).toBe('exempt');
  });

  it('treats built property before first occupancy and building plots as mandatorily taxable', () => {
    expect(evaluatePropertySaleExemption({
      effectiveDate: '2026-09-01', propertyKind: 'built', propertyResidential: true,
      firstOccupancy: { status: 'not_occurred' }, qualifyingUseOrUnitChange: { status: 'none' },
      sellerDomesticVatRegistered: true, taxableElectionScope: 'none', taxableElectionDeclaredAndEffective: false
    })).toMatchObject({
      rulesetId: 'HU-VAT-2026-007', status: 'not_exempt_under_supported_rule', treatment: 'mandatory_taxable',
      treatmentCode: 'HU_86_1_JA_NEW_PROPERTY_MANDATORY_TAXABLE', propertyClassification: 'new_built_property'
    });

    expect(evaluatePropertySaleExemption({
      effectiveDate: '2026-09-01', propertyKind: 'undeveloped', buildingPlot: true,
      sellerDomesticVatRegistered: true, taxableElectionScope: 'none', taxableElectionDeclaredAndEffective: false
    })).toMatchObject({
      treatment: 'mandatory_taxable', treatmentCode: 'HU_86_1_K_BUILDING_PLOT_MANDATORY_TAXABLE', propertyClassification: 'building_plot'
    });
  });

  it('uses an exact two-calendar-year boundary for first occupancy', () => {
    const common = {
      propertyKind: 'built' as const, propertyResidential: true,
      firstOccupancy: { status: 'occurred' as const, statutoryEvidenceDate: '2024-09-01' },
      qualifyingUseOrUnitChange: { status: 'none' as const }, sellerDomesticVatRegistered: true,
      taxableElectionScope: 'none' as const, taxableElectionDeclaredAndEffective: false
    };

    expect(evaluatePropertySaleExemption({ effectiveDate: '2026-08-31', ...common }))
      .toMatchObject({ treatment: 'mandatory_taxable', treatmentCode: 'HU_86_1_JB_NEW_PROPERTY_WITHIN_TWO_YEARS' });
    expect(evaluatePropertySaleExemption({ effectiveDate: '2026-09-01', ...common }))
      .toMatchObject({ status: 'exempt', treatment: 'exempt', propertyClassification: 'old_built_property' });
  });

  it('clamps a leap-day evidence anniversary to the last valid February day', () => {
    const common = {
      propertyKind: 'built' as const, propertyResidential: true,
      firstOccupancy: { status: 'occurred' as const, statutoryEvidenceDate: '2024-02-29' },
      qualifyingUseOrUnitChange: { status: 'none' as const }, sellerDomesticVatRegistered: true,
      taxableElectionScope: 'none' as const, taxableElectionDeclaredAndEffective: false
    };

    expect(evaluatePropertySaleExemption({ effectiveDate: '2026-02-27', ...common }).treatment).toBe('mandatory_taxable');
    expect(evaluatePropertySaleExemption({ effectiveDate: '2026-02-28', ...common }).treatment).toBe('exempt');
  });

  it('reopens the two-year new-property window after a qualifying purpose or unit-count change', () => {
    expect(evaluatePropertySaleExemption({
      effectiveDate: '2026-09-01', propertyKind: 'built', propertyResidential: false,
      firstOccupancy: { status: 'occurred', statutoryEvidenceDate: '2020-01-10' },
      qualifyingUseOrUnitChange: { status: 'occurred', statutoryEvidenceDate: '2026-01-10' },
      sellerDomesticVatRegistered: true, taxableElectionScope: 'none', taxableElectionDeclaredAndEffective: false
    })).toMatchObject({
      treatment: 'mandatory_taxable', treatmentCode: 'HU_86_1_JC_CHANGED_PROPERTY_WITHIN_TWO_YEARS', propertyClassification: 'new_built_property'
    });
  });

  it('applies a confirmed §88 property-sale election only within its scope', () => {
    const oldProperty = {
      effectiveDate: '2026-09-01', propertyKind: 'built' as const,
      firstOccupancy: { status: 'occurred' as const, statutoryEvidenceDate: '2020-01-10' },
      qualifyingUseOrUnitChange: { status: 'none' as const }, sellerDomesticVatRegistered: true,
      taxableElectionScope: 'non_residential_only' as const, taxableElectionDeclaredAndEffective: true
    };

    expect(evaluatePropertySaleExemption({ ...oldProperty, propertyResidential: false }))
      .toMatchObject({ treatment: 'taxable_by_election', taxableElectionApplies: true, treatmentCode: 'HU_88_PROPERTY_SALE_TAXABLE_ELECTION' });
    expect(evaluatePropertySaleExemption({ ...oldProperty, propertyResidential: true }))
      .toMatchObject({ treatment: 'exempt', taxableElectionApplies: false });
  });

  it('fails closed when a property-sale election scope is not confirmed effective', () => {
    expect(evaluatePropertySaleExemption({
      effectiveDate: '2026-09-01', propertyKind: 'undeveloped', buildingPlot: false,
      sellerDomesticVatRegistered: true, taxableElectionScope: 'all_property_sales', taxableElectionDeclaredAndEffective: false
    })).toMatchObject({ status: 'manual_review', treatment: 'manual_review', treatmentCode: 'HU_88_PROPERTY_SALE_ELECTION_UNCONFIRMED' });
  });

  it('applies property-sale reverse charge only to a §88-elected sale with qualifying parties', () => {
    const electedSale = {
      effectiveDate: '2026-09-01', propertyKind: 'built' as const, propertyResidential: false,
      firstOccupancy: { status: 'occurred' as const, statutoryEvidenceDate: '2020-01-10' },
      qualifyingUseOrUnitChange: { status: 'none' as const }, sellerDomesticVatRegistered: true,
      taxableElectionScope: 'all_property_sales' as const, taxableElectionDeclaredAndEffective: true
    };

    expect(evaluatePropertySaleReverseCharge({
      sale: electedSale, recipientDomesticVatRegistered: true, supplierTaxPayableStatus: true, recipientTaxPayableStatus: true
    })).toMatchObject({
      rulesetId: 'HU-VAT-2026-007', status: 'reverse_charge', eligible: true,
      mechanism: 'domestic_reverse_charge_property_sale', failedChecks: []
    });

    expect(evaluatePropertySaleReverseCharge({
      sale: electedSale, recipientDomesticVatRegistered: false, supplierTaxPayableStatus: true, recipientTaxPayableStatus: true
    })).toMatchObject({ status: 'not_reverse_charge_under_supported_rule', eligible: false, failedChecks: ['recipientDomesticVatRegistered'] });
  });

  it('does not route a mandatorily taxable new-property sale through the §142 (1) e) path', () => {
    expect(evaluatePropertySaleReverseCharge({
      sale: {
        effectiveDate: '2026-09-01', propertyKind: 'built', propertyResidential: true,
        firstOccupancy: { status: 'not_occurred' }, qualifyingUseOrUnitChange: { status: 'none' },
        sellerDomesticVatRegistered: true, taxableElectionScope: 'none', taxableElectionDeclaredAndEffective: false
      },
      recipientDomesticVatRegistered: true, supplierTaxPayableStatus: true, recipientTaxPayableStatus: true
    })).toMatchObject({ status: 'not_reverse_charge_under_supported_rule', eligible: false });
  });

  it('calculates VAT exactly from net and gross amounts', () => {
    expect(calculateHungaryVat({ effectiveDate: '2026-09-01', amount: '100.00', amountType: 'net', treatment: 'taxable', rate: 27 }))
      .toMatchObject({ rulesetId: 'HU-VAT-2026-007', netAmount: '100.00', vatAmount: '27.00', grossAmount: '127.00' });
    expect(calculateHungaryVat({ effectiveDate: '2026-09-01', amount: '127.00', amountType: 'gross', treatment: 'taxable', rate: 27 }))
      .toMatchObject({ rulesetId: 'HU-VAT-2026-007', netAmount: '100.00', vatAmount: '27.00', grossAmount: '127.00' });
  });

  it('does not charge seller VAT for reverse charge', () => {
    expect(calculateHungaryVat({ effectiveDate: '2026-09-01', amount: '100.00', amountType: 'net', treatment: 'reverse_charge' }))
      .toMatchObject({ vatAmount: '0.00', sellerChargesVat: false, recipientAccountingRequired: true });
  });

  it('resolves the statutory exchange-rate date and converts an MNB quote exactly', () => {
    expect(convertHungaryVatAmountToHuf({
      currency: 'EUR', amount: '100.00', outputScale: 2,
      transaction: { kind: 'periodic_settlement_section_58', invoiceIssueDate: '2026-08-20' },
      rate: {
        source: 'mnb', quotedCurrencyUnits: '1', hufAmount: '395.12', ratePublicationDate: '2026-08-20',
        latestValidRateConfirmed: true, electionDeclaredToNavBeforeUse: true,
        electionAppliesToAllForeignCurrencyTransactions: true, electionLockInObserved: true,
        exclusiveMnbOrEcbChoiceConfirmed: true
      }
    })).toMatchObject({
      rulesetId: 'HU-VAT-2026-007', status: 'converted', amountHuf: '39512.00',
      conversionDate: '2026-08-20', dateRule: 'invoice_issue_date', rateSource: 'mnb'
    });
  });

  it('uses the EKB euro cross-rate for a non-euro currency', () => {
    expect(convertHungaryVatAmountToHuf({
      currency: 'USD', amount: '100.00', outputScale: 2,
      transaction: { kind: 'other', performanceDate: '2026-09-01' },
      rate: {
        source: 'ecb', hufUnitsPerEur: '395.40', foreignCurrencyUnitsPerEur: '1.10',
        ratePublicationDate: '2026-09-01', latestValidRateConfirmed: true,
        electionDeclaredToNavBeforeUse: true, electionAppliesToAllForeignCurrencyTransactions: true,
        electionLockInObserved: true, exclusiveMnbOrEcbChoiceConfirmed: true
      }
    })).toMatchObject({ status: 'converted', amountHuf: '35945.45', dateRule: 'performance_date', rateSource: 'ecb' });
  });

  it('fails closed when official-rate election evidence is incomplete', () => {
    expect(convertHungaryVatAmountToHuf({
      currency: 'EUR', amount: '100',
      transaction: { kind: 'advance_payment', taxLiabilityDeterminationDate: '2026-09-01' },
      rate: {
        source: 'mnb', quotedCurrencyUnits: '1', hufAmount: '395.12', ratePublicationDate: '2026-09-01',
        latestValidRateConfirmed: true, electionDeclaredToNavBeforeUse: false,
        electionAppliesToAllForeignCurrencyTransactions: true, electionLockInObserved: true,
        exclusiveMnbOrEcbChoiceConfirmed: true
      }
    })).toMatchObject({ status: 'manual_review', dateRule: 'tax_liability_determination_date' });

    expect(convertHungaryVatAmountToHuf({
      currency: 'EUR', amount: '100',
      transaction: { kind: 'other', performanceDate: '2026-09-01' },
      rate: {
        source: 'ecb', hufUnitsPerEur: '395.12', ratePublicationDate: '2026-09-01',
        latestValidRateConfirmed: true, electionDeclaredToNavBeforeUse: true,
        electionAppliesToAllForeignCurrencyTransactions: true, electionLockInObserved: true,
        exclusiveMnbOrEcbChoiceConfirmed: false
      }
    })).toMatchObject({ status: 'manual_review', reason: expect.stringMatching(/not used together/) });
  });

  it('shows the exact difference between per-line and per-rate-summary VAT rounding', () => {
    const result = aggregateHungaryVatInvoice({
      effectiveDate: '2026-09-01', currency: 'HUF', scale: 2, roundingPolicy: 'per_vat_rate_summary',
      lines: [
        { lineId: '1', netAmount: '0.01', treatment: 'taxable', rate: 27 },
        { lineId: '2', netAmount: '0.01', treatment: 'taxable', rate: 27 },
        { lineId: '3', netAmount: '0.01', treatment: 'taxable', rate: 27 }
      ]
    });
    expect(result).toMatchObject({
      rulesetId: 'HU-VAT-2026-007', roundingPolicy: 'per_vat_rate_summary',
      totals: {
        netAmount: '0.03', lineRoundedVatAmount: '0.00', rateSummaryRoundedVatAmount: '0.01',
        roundingDifference: '0.01', selectedVatAmount: '0.01', selectedGrossAmount: '0.04'
      },
      reconciliation: {
        differenceDetected: true, allocationRequiredForLineReconciliation: true,
        selectedPolicyReconcilesTo: 'sum_of_rate_summary_rounded_vat'
      }
    });
    expect(result.lines[0]).toMatchObject({
      exactVatMinorUnits: { numerator: '27', denominator: '100' }, lineRoundedVatAmount: '0.00'
    });
  });

  it('keeps exempt and reverse-charge invoice groups at zero seller VAT', () => {
    const result = aggregateHungaryVatInvoice({
      effectiveDate: '2026-09-01', currency: 'EUR', roundingPolicy: 'per_line',
      lines: [
        { lineId: 'tax', netAmount: '10.00', treatment: 'taxable', rate: 5 },
        { lineId: 'exempt', netAmount: '20.00', treatment: 'exempt' },
        { lineId: 'rc', netAmount: '30.00', treatment: 'reverse_charge' }
      ]
    });
    expect(result.totals).toMatchObject({ netAmount: '60.00', selectedVatAmount: '0.50', selectedGrossAmount: '60.50' });
    expect(result.summaries.find((entry) => entry.treatment === 'reverse_charge'))
      .toMatchObject({ rate: null, selectedVatAmount: '0.00' });
  });

  it('detects group-level rounding differences even when invoice-level differences cancel out', () => {
    const result = aggregateHungaryVatInvoice({
      effectiveDate: '2026-09-01', currency: 'HUF', scale: 2, roundingPolicy: 'per_line',
      lines: [
        { lineId: '27-a', netAmount: '0.01', treatment: 'taxable', rate: 27 },
        { lineId: '27-b', netAmount: '0.01', treatment: 'taxable', rate: 27 },
        { lineId: '27-c', netAmount: '0.01', treatment: 'taxable', rate: 27 },
        { lineId: '5-a', netAmount: '0.10', treatment: 'taxable', rate: 5 },
        { lineId: '5-b', netAmount: '0.10', treatment: 'taxable', rate: 5 }
      ]
    });
    expect(result.totals.roundingDifference).toBe('0.00');
    expect(result.reconciliation).toMatchObject({ differenceDetected: true, allocationRequiredForLineReconciliation: false });
    expect(result.reconciliation.groupsWithDifference).toHaveLength(2);
  });

  it('resolves periodic tax points and fails closed outside the verification window', () => {
    expect(resolvePeriodicTaxPoint({ periodEnd: '2026-08-31', invoiceDate: '2026-08-20', dueDate: '2026-08-25' })).toMatchObject({ rulesetId: 'HU-VAT-2026-007', taxPoint: '2026-08-20' });
    expect(resolvePeriodicTaxPoint({ periodEnd: '2026-06-30', invoiceDate: '2026-06-30', dueDate: '2026-11-01' }).taxPoint).toBe('2026-08-29');
    expect(() => resolvePeriodicTaxPoint({ periodEnd: '2026-07-31', invoiceDate: '2026-07-31', dueDate: '2026-11-01' })).toThrow(/verified only through/);
  });

  it('evaluates the supported construction reverse-charge facts', () => {
    expect(evaluateDomesticConstructionReverseCharge({
      effectiveDate: '2026-09-01', supplierDomesticVatRegistered: true, recipientDomesticVatRegistered: true,
      supplierTaxPayableStatus: true, recipientTaxPayableStatus: true, constructionAssemblyWork: true,
      propertyActivity: 'transform', authorityPermitOrNotificationRequired: true, requiredDeclarationProvided: true
    })).toMatchObject({ rulesetId: 'HU-VAT-2026-007', eligible: true });
  });

  it('treats 19m prior-year turnover as within the 2026 AAM 20m threshold', () => {
    const result = evaluateAamThreshold2026({
      effectiveDate: '2026-09-01', establishedBefore2026: true, valuesCalculatedUnderSection188: true,
      priorYearRelevantDomesticTurnoverHuf: '19000000', currentYearExpectedRelevantDomesticTurnoverHuf: '19500000', currentYearActualRelevantDomesticTurnoverHuf: '12000000'
    });
    expect(result).toMatchObject({ status: 'eligible_within_threshold', thresholdMode: 'annual', thresholdHuf: '20000000', choiceEligible: true });
  });

  it('detects when the 2026 AAM threshold has already been exceeded', () => {
    const result = evaluateAamThreshold2026({
      effectiveDate: '2026-09-01', establishedBefore2026: true, valuesCalculatedUnderSection188: true,
      priorYearRelevantDomesticTurnoverHuf: '19000000', currentYearExpectedRelevantDomesticTurnoverHuf: '20000000', currentYearActualRelevantDomesticTurnoverHuf: '20000001'
    });
    expect(result).toMatchObject({ status: 'threshold_exceeded', thresholdExceededInCurrentYear: true });
  });

  it('calculates the exact section 189 threshold for a business registered on 2026-07-01', () => {
    const result = evaluateAamThreshold2026({
      effectiveDate: '2026-09-01', establishedBefore2026: false, registrationDate: '2026-07-01', valuesCalculatedUnderSection188: true,
      priorYearRelevantDomesticTurnoverHuf: '0', currentYearExpectedRelevantDomesticTurnoverHuf: '10082191', currentYearActualRelevantDomesticTurnoverHuf: '5000000'
    });
    expect(result).toMatchObject({
      rulesetId: 'HU-VAT-2026-007', status: 'eligible_within_threshold', thresholdMode: 'time_proportional', thresholdHuf: '10082191',
      registrationDate: '2026-07-01', activeDays: 184, daysInYear: 365, choiceEligible: true
    });
  });

  it('uses the exact fraction rather than a rounded display threshold at the section 189 boundary', () => {
    const result = evaluateAamThreshold2026({
      effectiveDate: '2026-09-01', establishedBefore2026: false, registrationDate: '2026-07-01', valuesCalculatedUnderSection188: true,
      priorYearRelevantDomesticTurnoverHuf: '0', currentYearExpectedRelevantDomesticTurnoverHuf: '10082192', currentYearActualRelevantDomesticTurnoverHuf: '0'
    });
    expect(result).toMatchObject({ status: 'not_eligible_for_choice', thresholdHuf: '10082191', choiceEligible: false });
  });

  it('returns manual review for new businesses if registrationDate is missing', () => {
    expect(evaluateAamThreshold2026({
      effectiveDate: '2026-09-01', establishedBefore2026: false, valuesCalculatedUnderSection188: true,
      priorYearRelevantDomesticTurnoverHuf: '0', currentYearExpectedRelevantDomesticTurnoverHuf: '5000000', currentYearActualRelevantDomesticTurnoverHuf: '1000000'
    }).status).toBe('manual_review');
  });

  it('rejects a registration date after the effective date', () => {
    expect(() => evaluateAamThreshold2026({
      effectiveDate: '2026-09-01', establishedBefore2026: false, registrationDate: '2026-10-01', valuesCalculatedUnderSection188: true,
      priorYearRelevantDomesticTurnoverHuf: '0', currentYearExpectedRelevantDomesticTurnoverHuf: '1', currentYearActualRelevantDomesticTurnoverHuf: '0'
    })).toThrow(/registrationDate cannot be later/);
  });

  it('has registered source metadata and fails closed after verification', () => {
    expect(HUNGARY_VAT_RULESET.sources.length).toBeGreaterThanOrEqual(10);
    expect(() => getHungaryVatRates('2026-09-02')).toThrow(/verified only through/);
  });
});
