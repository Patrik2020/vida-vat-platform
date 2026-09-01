import type { OpenAPIV3 } from 'openapi-types';

export const OPENAPI_DOCUMENT: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'ViDA Hungary VAT API',
    version: '0.7.0',
    description: 'Hungary-first VAT/compliance API. Phase 1 is deliberately fail-closed: unsupported or unverified legal classifications require review instead of guessing.'
  },
  tags: [
    { name: 'System' },
    { name: 'VAT rates' },
    { name: 'VAT calculation' },
    { name: 'Currency' },
    { name: 'Invoice arithmetic' },
    { name: 'Tax point' },
    { name: 'Reverse charge' },
    { name: 'Exemptions' },
    { name: 'AAM' }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Service health',
        responses: { '200': { description: 'Service is healthy', content: { 'application/json': { schema: { type: 'object', required: ['status', 'service', 'version'], properties: { status: { type: 'string', enum: ['ok'] }, service: { type: 'string' }, version: { type: 'string' } } } } } } }
      }
    },
    '/v1/hu/vat/rates': {
      get: {
        tags: ['VAT rates'],
        summary: 'Get supported Hungary VAT rates for a verified date',
        parameters: [{ name: 'effectiveDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } }],
        responses: {
          '200': { description: 'Rate catalogue', content: { 'application/json': { schema: { type: 'object', required: ['rulesetId', 'jurisdiction', 'effectiveDate', 'verifiedThrough', 'rates'], properties: { rulesetId: { type: 'string' }, jurisdiction: { type: 'string', enum: ['HU'] }, effectiveDate: { type: 'string', format: 'date' }, verifiedThrough: { type: 'string', format: 'date' }, rates: { type: 'array', items: { type: 'object' } } } } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' }
        }
      }
    },
    '/v1/hu/vat/classify-rate': {
      post: {
        tags: ['VAT rates'],
        summary: 'Classify a supported Hungary VAT rate',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RateClassificationRequest' } } } },
        responses: {
          '200': { description: 'Classification or manual-review result', content: { 'application/json': { schema: { type: 'object' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' }
        }
      }
    },
    '/v1/hu/vat/calculate': {
      post: {
        tags: ['VAT calculation'],
        summary: 'Calculate VAT from a net or gross amount',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/VatCalculationRequest' } } } },
        responses: {
          '200': { description: 'VAT calculation', content: { 'application/json': { schema: { type: 'object' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' }
        }
      }
    },
    '/v1/hu/vat/currency/convert-to-huf': {
      post: {
        tags: ['Currency'],
        summary: 'Convert a foreign-currency VAT amount to HUF under Áfa tv. 80–80/A. §',
        description: 'Resolves the statutory exchange-rate date from the transaction context, validates caller-supplied bank/MNB/EKB evidence, and converts with exact decimal arithmetic. Missing statutory evidence returns manual_review; import conversion under §81 remains outside this endpoint.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CurrencyConversionRequest' } } } },
        responses: {
          '200': { description: 'Converted amount or fail-closed manual-review result', content: { 'application/json': { schema: { $ref: '#/components/schemas/CurrencyConversionResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' }
        }
      }
    },
    '/v1/hu/vat/invoices/aggregate': {
      post: {
        tags: ['Invoice arithmetic'],
        summary: 'Calculate auditable invoice-line and VAT-rate-summary rounding',
        description: 'Calculates both per-line and per-VAT-rate-summary results, exposes their exact difference, and applies the explicitly caller-selected computational policy. It does not claim that either policy is universally mandated by statute.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/InvoiceAggregationRequest' } } } },
        responses: {
          '200': { description: 'Invoice arithmetic and reconciliation', content: { 'application/json': { schema: { $ref: '#/components/schemas/InvoiceAggregationResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' }
        }
      }
    },
    '/v1/hu/vat/tax-point/periodic': {
      post: {
        tags: ['Tax point'],
        summary: 'Resolve tax point for periodic-settlement transactions',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['periodEnd', 'invoiceDate', 'dueDate'], properties: { periodEnd: { type: 'string', format: 'date' }, invoiceDate: { type: 'string', format: 'date' }, dueDate: { type: 'string', format: 'date' } } } } } },
        responses: { '200': { description: 'Resolved tax point', content: { 'application/json': { schema: { type: 'object' } } } }, '400': { $ref: '#/components/responses/BadRequest' }, '422': { $ref: '#/components/responses/UnprocessableEntity' } }
      }
    },
    '/v1/hu/vat/reverse-charge/domestic-construction': {
      post: {
        tags: ['Reverse charge'],
        summary: 'Evaluate supported domestic construction reverse-charge conditions',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DomesticConstructionReverseChargeRequest' } } } },
        responses: { '200': { description: 'Reverse-charge evaluation', content: { 'application/json': { schema: { type: 'object' } } } }, '400': { $ref: '#/components/responses/BadRequest' }, '422': { $ref: '#/components/responses/UnprocessableEntity' } }
      }
    },
    '/v1/hu/vat/reverse-charge/property-sale': {
      post: {
        tags: ['Reverse charge'],
        summary: 'Evaluate domestic reverse charge for a §88-elected property sale',
        description: 'Applies only to an otherwise exempt §86 (1) j)–k) property sale made taxable by a confirmed §88 election, subject to the party-status conditions in §142. Mandatory-taxable new property and building plots are outside this reverse-charge path.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PropertySaleReverseChargeRequest' } } } },
        responses: {
          '200': { description: 'Property-sale reverse-charge evaluation', content: { 'application/json': { schema: { $ref: '#/components/schemas/PropertySaleReverseChargeResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' }
        }
      }
    },
    '/v1/hu/vat/exemptions/activity': {
      post: {
        tags: ['Exemptions'],
        summary: 'Evaluate supported activity-specific VAT exemptions under Áfa tv. 85–86. §',
        description: 'Covers bounded healthcare, dental, education, insurance, credit and payment/financial cases. A negative result means only that the supported exemption rule does not apply; it does not infer a fallback VAT rate.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ActivityExemptionRequest' } } } },
        responses: {
          '200': { description: 'Activity exemption evaluation', content: { 'application/json': { schema: { $ref: '#/components/schemas/ExemptionEvaluationResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' }
        }
      }
    },
    '/v1/hu/vat/exemptions/property-rental': {
      post: {
        tags: ['Exemptions'],
        summary: 'Evaluate Hungarian property-rental activity exemption',
        description: 'Implements the bounded activity-specific logic of Áfa tv. 86. § (1) l), 86. § (2) and the property-rental taxation election in 88. §. AAM and other personal exemptions remain separate.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PropertyRentalExemptionRequest' } } } },
        responses: {
          '200': { description: 'Property-rental exemption evaluation', content: { 'application/json': { schema: { $ref: '#/components/schemas/ExemptionEvaluationResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' }
        }
      }
    },
    '/v1/hu/vat/exemptions/property-sale': {
      post: {
        tags: ['Exemptions'],
        summary: 'Evaluate Hungarian property-sale exemption or statutory taxability',
        description: 'Implements the bounded property-sale logic of Áfa tv. 86. § (1) j)–k) and 88. §, including first occupancy, the two-year tests, qualifying purpose/unit changes, building plots and taxation elections. VAT rate and reverse charge remain separate decisions.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PropertySaleExemptionRequest' } } } },
        responses: {
          '200': { description: 'Property-sale treatment evaluation', content: { 'application/json': { schema: { $ref: '#/components/schemas/PropertySaleEvaluationResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' }
        }
      }
    },
    '/v1/hu/vat/exemptions/aam/threshold': {
      post: {
        tags: ['AAM'],
        summary: 'Evaluate the 2026 Hungarian small-business VAT exemption threshold',
        description: 'Existing taxpayers use the annual 20,000,000 HUF threshold. Taxpayers registered during 2026 use the exact time-proportional threshold under Áfa tv. 189. §, based on calendar days from registration through 31 December, inclusive.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AamThresholdRequest' } } } },
        responses: {
          '200': { description: 'AAM threshold evaluation', content: { 'application/json': { schema: { $ref: '#/components/schemas/AamThresholdResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' }
        }
      }
    }
  },
  components: {
    responses: {
      BadRequest: { description: 'Request validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
      UnprocessableEntity: { description: 'Request is syntactically valid but cannot be evaluated by the verified ruleset', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } }
    },
    schemas: {
      ErrorEnvelope: {
        type: 'object', required: ['error'],
        properties: { error: { type: 'object', required: ['code', 'message', 'requestId'], properties: { code: { type: 'string' }, message: { type: 'string' }, requestId: { type: 'string' }, details: {} } } }
      },
      ExemptionEvaluationResponse: {
        type: 'object', required: ['rulesetId', 'effectiveDate', 'status', 'legalBasis', 'sourceIds', 'reason', 'notice'],
        properties: {
          rulesetId: { type: 'string' }, effectiveDate: { type: 'string', format: 'date' },
          status: { type: 'string', enum: ['exempt', 'not_exempt_under_supported_rule', 'manual_review'] },
          exemptionCode: { type: 'string' }, exemptionNature: { type: 'string', enum: ['public_interest', 'specific_nature'] }, treatmentCode: { type: 'string' },
          legalBasis: { type: 'string' }, sourceIds: { type: 'array', items: { type: 'string' } }, reason: { type: 'string' }, notice: { type: 'string' }
        }
      },
      ActivityExemptionRequest: {
        oneOf: [
          {
            type: 'object', required: ['effectiveDate', 'kind', 'serviceIsHumanHealthcare', 'providerActsInHealthcareCapacity', 'permitRequired', 'permitHeld', 'qualificationRequired', 'qualifiedPersonAvailable'],
            properties: { effectiveDate: { type: 'string', format: 'date' }, kind: { type: 'string', enum: ['human_healthcare'] }, serviceIsHumanHealthcare: { type: 'boolean' }, providerActsInHealthcareCapacity: { type: 'boolean' }, permitRequired: { type: 'boolean' }, permitHeld: { type: 'boolean' }, qualificationRequired: { type: 'boolean' }, qualifiedPersonAvailable: { type: 'boolean' } }
          },
          {
            type: 'object', required: ['effectiveDate', 'kind', 'supply', 'providerActsInDentalCapacity', 'permitRequired', 'permitHeld', 'qualificationRequired', 'qualifiedPersonAvailable'],
            properties: { effectiveDate: { type: 'string', format: 'date' }, kind: { type: 'string', enum: ['dental'] }, supply: { type: 'string', enum: ['dental_service', 'dental_prosthesis'] }, providerActsInDentalCapacity: { type: 'boolean' }, permitRequired: { type: 'boolean' }, permitHeld: { type: 'boolean' }, qualificationRequired: { type: 'boolean' }, qualifiedPersonAvailable: { type: 'boolean' } }
          },
          {
            type: 'object', required: ['effectiveDate', 'kind', 'context', 'providerActsInTeachingCapacity', 'permitRequired', 'permitHeld', 'qualificationRequired', 'qualifiedPersonAvailable'],
            properties: { effectiveDate: { type: 'string', format: 'date' }, kind: { type: 'string', enum: ['education'] }, context: { type: 'string', enum: ['public_education', 'vocational_training', 'higher_education', 'adult_training', 'language_training', 'recognized_language_exam', 'study_competition', 'other'] }, providerActsInTeachingCapacity: { type: 'boolean' }, permitRequired: { type: 'boolean' }, permitHeld: { type: 'boolean' }, qualificationRequired: { type: 'boolean' }, qualifiedPersonAvailable: { type: 'boolean' } }
          },
          {
            type: 'object', required: ['effectiveDate', 'kind', 'service', 'actingInRelevantCapacity'],
            properties: { effectiveDate: { type: 'string', format: 'date' }, kind: { type: 'string', enum: ['insurance'] }, service: { type: 'string', enum: ['insurance', 'reinsurance', 'brokerage', 'intermediation'] }, actingInRelevantCapacity: { type: 'boolean' } }
          },
          {
            type: 'object', required: ['effectiveDate', 'kind', 'service', 'actingInRelevantCapacity'],
            properties: { effectiveDate: { type: 'string', format: 'date' }, kind: { type: 'string', enum: ['credit'] }, service: { type: 'string', enum: ['credit_provision', 'credit_intermediation', 'creditor_management'] }, actingInRelevantCapacity: { type: 'boolean' } }
          },
          {
            type: 'object', required: ['effectiveDate', 'kind', 'service', 'actingInRelevantCapacity', 'debtCollection', 'portfolioManagement'],
            properties: { effectiveDate: { type: 'string', format: 'date' }, kind: { type: 'string', enum: ['payment_financial'] }, service: { type: 'string', enum: ['current_account', 'deposit_account', 'customer_account', 'payment', 'transfer', 'cheque', 'receivable', 'financial_instrument', 'intermediation'] }, actingInRelevantCapacity: { type: 'boolean' }, debtCollection: { type: 'boolean' }, portfolioManagement: { type: 'boolean' } }
          }
        ]
      },
      PropertyRentalExemptionRequest: {
        type: 'object', required: ['effectiveDate', 'rentalKind', 'propertyResidential', 'taxableElectionScope', 'taxableElectionDeclaredAndEffective'],
        properties: {
          effectiveDate: { type: 'string', format: 'date' },
          rentalKind: { type: 'string', enum: ['ordinary', 'commercial_accommodation', 'vehicle_parking', 'permanently_attached_equipment', 'safe'] },
          propertyResidential: { type: 'boolean' },
          taxableElectionScope: { type: 'string', enum: ['none', 'all_property_rentals', 'non_residential_only'] },
          taxableElectionDeclaredAndEffective: { type: 'boolean' }
        }
      },
      PropertySaleExemptionRequest: {
        oneOf: [
          {
            type: 'object',
            required: ['effectiveDate', 'propertyKind', 'propertyResidential', 'firstOccupancy', 'qualifyingUseOrUnitChange', 'sellerDomesticVatRegistered', 'taxableElectionScope', 'taxableElectionDeclaredAndEffective'],
            properties: {
              effectiveDate: { type: 'string', format: 'date' },
              propertyKind: { type: 'string', enum: ['built'] },
              propertyResidential: { type: 'boolean' },
              firstOccupancy: {
                oneOf: [
                  { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['not_occurred'] } } },
                  { type: 'object', required: ['status', 'statutoryEvidenceDate'], properties: { status: { type: 'string', enum: ['occurred'] }, statutoryEvidenceDate: { type: 'string', format: 'date', description: 'Date of the legally relevant occupancy permit, acknowledgement or authority certificate.' } } }
                ]
              },
              qualifyingUseOrUnitChange: {
                oneOf: [
                  { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['none'] } } },
                  { type: 'object', required: ['status', 'statutoryEvidenceDate'], properties: { status: { type: 'string', enum: ['occurred'] }, statutoryEvidenceDate: { type: 'string', format: 'date', description: 'Date of the authority certificate proving the qualifying purpose or independent-unit-count change.' } } }
                ]
              },
              sellerDomesticVatRegistered: { type: 'boolean' },
              taxableElectionScope: { type: 'string', enum: ['none', 'all_property_sales', 'non_residential_only'] },
              taxableElectionDeclaredAndEffective: { type: 'boolean' }
            }
          },
          {
            type: 'object',
            required: ['effectiveDate', 'propertyKind', 'buildingPlot', 'sellerDomesticVatRegistered', 'taxableElectionScope', 'taxableElectionDeclaredAndEffective'],
            properties: {
              effectiveDate: { type: 'string', format: 'date' },
              propertyKind: { type: 'string', enum: ['undeveloped'] },
              buildingPlot: { type: 'boolean', description: 'Caller-confirmed classification under the statutory building-plot definition.' },
              sellerDomesticVatRegistered: { type: 'boolean' },
              taxableElectionScope: { type: 'string', enum: ['none', 'all_property_sales', 'non_residential_only'] },
              taxableElectionDeclaredAndEffective: { type: 'boolean' }
            }
          }
        ]
      },
      PropertySaleEvaluationResponse: {
        type: 'object',
        required: ['rulesetId', 'effectiveDate', 'status', 'treatment', 'treatmentCode', 'propertyClassification', 'taxableElectionApplies', 'legalBasis', 'sourceIds', 'reason', 'notice'],
        properties: {
          rulesetId: { type: 'string' },
          effectiveDate: { type: 'string', format: 'date' },
          status: { type: 'string', enum: ['exempt', 'not_exempt_under_supported_rule', 'manual_review'] },
          treatment: { type: 'string', enum: ['exempt', 'mandatory_taxable', 'taxable_by_election', 'manual_review'] },
          treatmentCode: { type: 'string' },
          propertyClassification: { type: 'string', enum: ['new_built_property', 'old_built_property', 'building_plot', 'other_undeveloped_property', 'undetermined'] },
          taxableElectionApplies: { type: 'boolean', nullable: true },
          legalBasis: { type: 'string' },
          sourceIds: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
          notice: { type: 'string' }
        }
      },
      PropertySaleReverseChargeRequest: {
        type: 'object',
        required: ['sale', 'recipientDomesticVatRegistered', 'supplierTaxPayableStatus', 'recipientTaxPayableStatus'],
        properties: {
          sale: { $ref: '#/components/schemas/PropertySaleExemptionRequest' },
          recipientDomesticVatRegistered: { type: 'boolean' },
          supplierTaxPayableStatus: { type: 'boolean', description: 'Confirms that the supplier has no VAT status under which tax payment cannot be required.' },
          recipientTaxPayableStatus: { type: 'boolean', description: 'Confirms that the recipient has no VAT status under which tax payment cannot be required.' }
        }
      },
      PropertySaleReverseChargeResponse: {
        type: 'object',
        required: ['rulesetId', 'effectiveDate', 'status', 'eligible', 'mechanism', 'propertySaleTreatmentCode', 'checks', 'failedChecks', 'legalBasis', 'sourceIds', 'reason', 'notice'],
        properties: {
          rulesetId: { type: 'string' },
          effectiveDate: { type: 'string', format: 'date' },
          status: { type: 'string', enum: ['reverse_charge', 'not_reverse_charge_under_supported_rule', 'manual_review'] },
          eligible: { type: 'boolean', nullable: true },
          mechanism: { type: 'string', enum: ['domestic_reverse_charge_property_sale'] },
          propertySaleTreatmentCode: { type: 'string' },
          checks: { type: 'object', additionalProperties: { type: 'boolean' } },
          failedChecks: { type: 'array', items: { type: 'string' } },
          legalBasis: { type: 'string' },
          sourceIds: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
          notice: { type: 'string' }
        }
      },
      RateClassificationRequest: {
        type: 'object', required: ['effectiveDate', 'classification'],
        properties: {
          effectiveDate: { type: 'string', format: 'date' },
          classification: {
            oneOf: [
              { type: 'object', required: ['kind', 'customsTariffCode', 'issuesPerWeek'], properties: { kind: { type: 'string', enum: ['daily_newspaper'] }, customsTariffCode: { type: 'string' }, issuesPerWeek: { type: 'integer', minimum: 0 } } },
              { type: 'object', required: ['kind', 'prescriptionRequired', 'magistral', 'humanUse'], properties: { kind: { type: 'string', enum: ['medicine'] }, prescriptionRequired: { type: 'boolean' }, magistral: { type: 'boolean' }, humanUse: { type: 'boolean' } } },
              { type: 'object', required: ['kind', 'category', 'customsTariffCode', 'statutoryDescriptionConfirmed'], properties: { kind: { type: 'string', enum: ['reduced_rate_18_product'] }, category: { type: 'string', enum: ['milk_or_dairy', 'flavored_milk', 'cereal_flour_starch_or_milk_preparation'] }, customsTariffCode: { type: 'string' }, statutoryDescriptionConfirmed: { type: 'boolean' } } },
              { type: 'object', required: ['kind', 'customsTariffCode', 'domesticatedCattle', 'fitForHumanConsumption', 'preservation'], properties: { kind: { type: 'string', enum: ['domesticated_cattle_food_product'] }, customsTariffCode: { type: 'string' }, domesticatedCattle: { type: 'boolean' }, fitForHumanConsumption: { type: 'boolean' }, preservation: { type: 'string', enum: ['fresh', 'chilled', 'frozen', 'salted_or_brined', 'dried', 'smoked', 'other'] } } },
              { type: 'object', required: ['kind', 'rate', 'legalBasisConfirmed'], properties: { kind: { type: 'string', enum: ['declared_rate'] }, rate: { type: 'number', enum: [0, 5, 18, 27] }, legalBasisConfirmed: { type: 'boolean' } } }
            ]
          }
        }
      },
      VatCalculationRequest: {
        type: 'object', required: ['effectiveDate', 'amount', 'amountType', 'treatment'],
        properties: { effectiveDate: { type: 'string', format: 'date' }, amount: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' }, amountType: { type: 'string', enum: ['net', 'gross'] }, treatment: { type: 'string', enum: ['taxable', 'exempt', 'reverse_charge'] }, rate: { type: 'number', enum: [0, 5, 18, 27] }, scale: { type: 'integer', minimum: 0, maximum: 6 } }
      },
      CurrencyConversionRequest: {
        type: 'object', required: ['currency', 'amount', 'transaction', 'rate'],
        properties: {
          currency: { type: 'string', pattern: '^[A-Z]{3}$', description: 'Three-letter non-HUF source currency.' },
          amount: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
          outputScale: { type: 'integer', minimum: 0, maximum: 6, default: 2 },
          transaction: {
            oneOf: [
              { type: 'object', required: ['kind', 'taxLiabilityDeterminationDate'], properties: { kind: { type: 'string', enum: ['intra_community_acquisition'] }, taxLiabilityDeterminationDate: { type: 'string', format: 'date' } } },
              { type: 'object', required: ['kind', 'taxLiabilityDeterminationDate'], properties: { kind: { type: 'string', enum: ['advance_payment'] }, taxLiabilityDeterminationDate: { type: 'string', format: 'date' } } },
              { type: 'object', required: ['kind', 'taxLiabilityDeterminationDate'], properties: { kind: { type: 'string', enum: ['section_60'] }, taxLiabilityDeterminationDate: { type: 'string', format: 'date' } } },
              { type: 'object', required: ['kind', 'invoiceIssueDate'], properties: { kind: { type: 'string', enum: ['periodic_settlement_section_58'] }, invoiceIssueDate: { type: 'string', format: 'date' } } },
              { type: 'object', required: ['kind', 'performanceDate'], properties: { kind: { type: 'string', enum: ['other'] }, performanceDate: { type: 'string', format: 'date' } } }
            ]
          },
          rate: {
            oneOf: [
              {
                type: 'object', required: ['source', 'quotedCurrencyUnits', 'hufAmount', 'ratePublicationDate', 'latestValidRateConfirmed', 'institutionAuthorisedForDomesticCurrencyExchange'],
                properties: { source: { type: 'string', enum: ['domestic_credit_institution_sell'] }, quotedCurrencyUnits: { type: 'string' }, hufAmount: { type: 'string' }, ratePublicationDate: { type: 'string', format: 'date' }, latestValidRateConfirmed: { type: 'boolean' }, institutionAuthorisedForDomesticCurrencyExchange: { type: 'boolean' } }
              },
              {
                type: 'object', required: ['source', 'quotedCurrencyUnits', 'hufAmount', 'ratePublicationDate', 'latestValidRateConfirmed', 'electionDeclaredToNavBeforeUse', 'electionAppliesToAllForeignCurrencyTransactions', 'electionLockInObserved', 'exclusiveMnbOrEcbChoiceConfirmed'],
                properties: { source: { type: 'string', enum: ['mnb'] }, quotedCurrencyUnits: { type: 'string' }, hufAmount: { type: 'string' }, ratePublicationDate: { type: 'string', format: 'date' }, latestValidRateConfirmed: { type: 'boolean' }, electionDeclaredToNavBeforeUse: { type: 'boolean' }, electionAppliesToAllForeignCurrencyTransactions: { type: 'boolean' }, electionLockInObserved: { type: 'boolean' }, exclusiveMnbOrEcbChoiceConfirmed: { type: 'boolean' } }
              },
              {
                type: 'object', required: ['source', 'hufUnitsPerEur', 'ratePublicationDate', 'latestValidRateConfirmed', 'electionDeclaredToNavBeforeUse', 'electionAppliesToAllForeignCurrencyTransactions', 'electionLockInObserved', 'exclusiveMnbOrEcbChoiceConfirmed'],
                properties: { source: { type: 'string', enum: ['ecb'] }, hufUnitsPerEur: { type: 'string' }, foreignCurrencyUnitsPerEur: { type: 'string', description: 'Required when currency is not EUR.' }, ratePublicationDate: { type: 'string', format: 'date' }, latestValidRateConfirmed: { type: 'boolean' }, electionDeclaredToNavBeforeUse: { type: 'boolean' }, electionAppliesToAllForeignCurrencyTransactions: { type: 'boolean' }, electionLockInObserved: { type: 'boolean' }, exclusiveMnbOrEcbChoiceConfirmed: { type: 'boolean' } }
              },
              {
                type: 'object', required: ['source', 'precedingQuarterEuroReferenceConfirmed'],
                properties: { source: { type: 'string', enum: ['unquoted_currency_section_80_5'] }, precedingQuarterEuroReferenceConfirmed: { type: 'boolean' } }
              }
            ]
          }
        }
      },
      CurrencyConversionResponse: {
        type: 'object', required: ['rulesetId', 'status', 'currency', 'inputAmount', 'conversionDate', 'dateRule', 'rateSource', 'legalBasis', 'sourceIds', 'notice'],
        properties: {
          rulesetId: { type: 'string' }, status: { type: 'string', enum: ['converted', 'manual_review'] }, currency: { type: 'string' }, inputAmount: { type: 'string' }, amountHuf: { type: 'string' }, outputScale: { type: 'integer' },
          conversionDate: { type: 'string', format: 'date' }, dateRule: { type: 'string', enum: ['tax_liability_determination_date', 'invoice_issue_date', 'performance_date'] },
          rateSource: { type: 'string', enum: ['domestic_credit_institution_sell', 'mnb', 'ecb', 'unquoted_currency_section_80_5'] }, ratePublicationDate: { type: 'string', format: 'date' },
          legalBasis: { type: 'string' }, sourceIds: { type: 'array', items: { type: 'string' } }, rounding: { type: 'string' }, reason: { type: 'string' }, notice: { type: 'string' }
        }
      },
      InvoiceAggregationRequest: {
        type: 'object', required: ['effectiveDate', 'currency', 'roundingPolicy', 'lines'],
        properties: {
          effectiveDate: { type: 'string', format: 'date' }, currency: { type: 'string', pattern: '^[A-Z]{3}$' }, scale: { type: 'integer', minimum: 0, maximum: 6, default: 2 },
          roundingPolicy: { type: 'string', enum: ['per_line', 'per_vat_rate_summary'] },
          lines: {
            type: 'array', minItems: 1, maxItems: 500,
            items: { type: 'object', required: ['lineId', 'netAmount', 'treatment'], properties: { lineId: { type: 'string', minLength: 1, maxLength: 100 }, netAmount: { type: 'string', pattern: '^-?\\d+(\\.\\d+)?$' }, treatment: { type: 'string', enum: ['taxable', 'exempt', 'reverse_charge'] }, rate: { type: 'number', enum: [0, 5, 18, 27] } } }
          }
        }
      },
      InvoiceAggregationResponse: {
        type: 'object', required: ['rulesetId', 'effectiveDate', 'currency', 'scale', 'roundingPolicy', 'roundingMode', 'policyNature', 'lines', 'summaries', 'totals', 'reconciliation', 'legalBasis', 'sourceIds', 'notice'],
        properties: {
          rulesetId: { type: 'string' }, effectiveDate: { type: 'string', format: 'date' }, currency: { type: 'string' }, scale: { type: 'integer' }, roundingPolicy: { type: 'string', enum: ['per_line', 'per_vat_rate_summary'] }, roundingMode: { type: 'string' }, policyNature: { type: 'string', enum: ['caller_selected_computational_policy'] },
          lines: { type: 'array', items: { type: 'object' } }, summaries: { type: 'array', items: { type: 'object' } }, totals: { type: 'object' }, reconciliation: { type: 'object' }, legalBasis: { type: 'string' }, sourceIds: { type: 'array', items: { type: 'string' } }, notice: { type: 'string' }
        }
      },
      DomesticConstructionReverseChargeRequest: {
        type: 'object', required: ['effectiveDate', 'supplierDomesticVatRegistered', 'recipientDomesticVatRegistered', 'supplierTaxPayableStatus', 'recipientTaxPayableStatus', 'constructionAssemblyWork', 'propertyActivity', 'authorityPermitOrNotificationRequired', 'requiredDeclarationProvided'],
        properties: { effectiveDate: { type: 'string', format: 'date' }, supplierDomesticVatRegistered: { type: 'boolean' }, recipientDomesticVatRegistered: { type: 'boolean' }, supplierTaxPayableStatus: { type: 'boolean' }, recipientTaxPayableStatus: { type: 'boolean' }, constructionAssemblyWork: { type: 'boolean' }, propertyActivity: { type: 'string', enum: ['create', 'expand', 'transform', 'demolish', 'change_purpose', 'other'] }, authorityPermitOrNotificationRequired: { type: 'boolean' }, requiredDeclarationProvided: { type: 'boolean' } }
      },
      AamThresholdRequest: {
        type: 'object', required: ['effectiveDate', 'establishedBefore2026', 'valuesCalculatedUnderSection188', 'priorYearRelevantDomesticTurnoverHuf', 'currentYearExpectedRelevantDomesticTurnoverHuf', 'currentYearActualRelevantDomesticTurnoverHuf'],
        properties: { effectiveDate: { type: 'string', format: 'date' }, establishedBefore2026: { type: 'boolean' }, registrationDate: { type: 'string', format: 'date', description: 'Required for taxpayers registered during 2026.' }, valuesCalculatedUnderSection188: { type: 'boolean' }, priorYearRelevantDomesticTurnoverHuf: { type: 'string', pattern: '^\\d+$' }, currentYearExpectedRelevantDomesticTurnoverHuf: { type: 'string', pattern: '^\\d+$' }, currentYearActualRelevantDomesticTurnoverHuf: { type: 'string', pattern: '^\\d+$' } }
      },
      AamThresholdResponse: {
        type: 'object', required: ['rulesetId', 'effectiveDate', 'status', 'annualThresholdHuf', 'sourceIds'],
        properties: { rulesetId: { type: 'string' }, effectiveDate: { type: 'string', format: 'date' }, status: { type: 'string', enum: ['eligible_within_threshold', 'not_eligible_for_choice', 'threshold_exceeded', 'manual_review'] }, thresholdMode: { type: 'string', enum: ['annual', 'time_proportional'] }, annualThresholdHuf: { type: 'string' }, thresholdHuf: { type: 'string' }, registrationDate: { type: 'string', format: 'date' }, activeDays: { type: 'integer' }, daysInYear: { type: 'integer' }, thresholdExact: { type: 'object' }, choiceEligible: { type: 'boolean' }, thresholdExceededInCurrentYear: { type: 'boolean' }, checks: { type: 'object' }, values: { type: 'object' }, legalBasis: { type: 'string' }, sourceIds: { type: 'array', items: { type: 'string' } }, notice: { type: 'string' }, reason: { type: 'string' } }
      }
    }
  }
};
