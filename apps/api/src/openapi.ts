export const OPENAPI_DOCUMENT = {
  openapi: '3.1.0',
  info: {
    title: 'ViDA Hungary VAT API',
    version: '0.4.0',
    description: 'Hungary-first VAT/compliance API. Phase 1 is deliberately fail-closed: unsupported or unverified legal classifications require review instead of guessing.'
  },
  tags: [
    { name: 'System' },
    { name: 'VAT rates' },
    { name: 'VAT calculation' },
    { name: 'Tax point' },
    { name: 'Reverse charge' },
    { name: 'AAM' }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Service health',
        responses: { '200': { description: 'Service is healthy', content: { 'application/json': { schema: { type: 'object', required: ['status', 'service', 'version'], properties: { status: { const: 'ok' }, service: { type: 'string' }, version: { type: 'string' } } } } } } }
      }
    },
    '/v1/hu/vat/rates': {
      get: {
        tags: ['VAT rates'],
        summary: 'Get supported Hungary VAT rates for a verified date',
        parameters: [{ name: 'effectiveDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } }],
        responses: {
          '200': { description: 'Rate catalogue', content: { 'application/json': { schema: { type: 'object', required: ['rulesetId', 'jurisdiction', 'effectiveDate', 'verifiedThrough', 'rates'], properties: { rulesetId: { type: 'string' }, jurisdiction: { const: 'HU' }, effectiveDate: { type: 'string', format: 'date' }, verifiedThrough: { type: 'string', format: 'date' }, rates: { type: 'array', items: { type: 'object' } } } } } } },
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
      RateClassificationRequest: {
        type: 'object', required: ['effectiveDate', 'classification'],
        properties: {
          effectiveDate: { type: 'string', format: 'date' },
          classification: {
            oneOf: [
              { type: 'object', required: ['kind', 'customsTariffCode', 'issuesPerWeek'], properties: { kind: { const: 'daily_newspaper' }, customsTariffCode: { type: 'string' }, issuesPerWeek: { type: 'integer', minimum: 0 } } },
              { type: 'object', required: ['kind', 'prescriptionRequired', 'magistral', 'humanUse'], properties: { kind: { const: 'medicine' }, prescriptionRequired: { type: 'boolean' }, magistral: { type: 'boolean' }, humanUse: { type: 'boolean' } } },
              { type: 'object', required: ['kind', 'category', 'customsTariffCode', 'statutoryDescriptionConfirmed'], properties: { kind: { const: 'reduced_rate_18_product' }, category: { enum: ['milk_or_dairy', 'flavored_milk', 'cereal_flour_starch_or_milk_preparation'] }, customsTariffCode: { type: 'string' }, statutoryDescriptionConfirmed: { type: 'boolean' } } },
              { type: 'object', required: ['kind', 'customsTariffCode', 'domesticatedCattle', 'fitForHumanConsumption', 'preservation'], properties: { kind: { const: 'domesticated_cattle_food_product' }, customsTariffCode: { type: 'string' }, domesticatedCattle: { type: 'boolean' }, fitForHumanConsumption: { type: 'boolean' }, preservation: { enum: ['fresh', 'chilled', 'frozen', 'salted_or_brined', 'dried', 'smoked', 'other'] } } },
              { type: 'object', required: ['kind', 'rate', 'legalBasisConfirmed'], properties: { kind: { const: 'declared_rate' }, rate: { enum: [0, 5, 18, 27] }, legalBasisConfirmed: { type: 'boolean' } } }
            ]
          }
        }
      },
      VatCalculationRequest: {
        type: 'object', required: ['effectiveDate', 'amount', 'amountType', 'treatment'],
        properties: { effectiveDate: { type: 'string', format: 'date' }, amount: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' }, amountType: { enum: ['net', 'gross'] }, treatment: { enum: ['taxable', 'exempt', 'reverse_charge'] }, rate: { enum: [0, 5, 18, 27] }, scale: { type: 'integer', minimum: 0, maximum: 6 } }
      },
      DomesticConstructionReverseChargeRequest: {
        type: 'object', required: ['effectiveDate', 'supplierDomesticVatRegistered', 'recipientDomesticVatRegistered', 'supplierTaxPayableStatus', 'recipientTaxPayableStatus', 'constructionAssemblyWork', 'propertyActivity', 'authorityPermitOrNotificationRequired', 'requiredDeclarationProvided'],
        properties: { effectiveDate: { type: 'string', format: 'date' }, supplierDomesticVatRegistered: { type: 'boolean' }, recipientDomesticVatRegistered: { type: 'boolean' }, supplierTaxPayableStatus: { type: 'boolean' }, recipientTaxPayableStatus: { type: 'boolean' }, constructionAssemblyWork: { type: 'boolean' }, propertyActivity: { enum: ['create', 'expand', 'transform', 'demolish', 'change_purpose', 'other'] }, authorityPermitOrNotificationRequired: { type: 'boolean' }, requiredDeclarationProvided: { type: 'boolean' } }
      },
      AamThresholdRequest: {
        type: 'object', required: ['effectiveDate', 'establishedBefore2026', 'valuesCalculatedUnderSection188', 'priorYearRelevantDomesticTurnoverHuf', 'currentYearExpectedRelevantDomesticTurnoverHuf', 'currentYearActualRelevantDomesticTurnoverHuf'],
        properties: { effectiveDate: { type: 'string', format: 'date' }, establishedBefore2026: { type: 'boolean' }, registrationDate: { type: 'string', format: 'date', description: 'Required for taxpayers registered during 2026.' }, valuesCalculatedUnderSection188: { type: 'boolean' }, priorYearRelevantDomesticTurnoverHuf: { type: 'string', pattern: '^\\d+$' }, currentYearExpectedRelevantDomesticTurnoverHuf: { type: 'string', pattern: '^\\d+$' }, currentYearActualRelevantDomesticTurnoverHuf: { type: 'string', pattern: '^\\d+$' } }
      },
      AamThresholdResponse: {
        type: 'object', required: ['rulesetId', 'effectiveDate', 'status', 'annualThresholdHuf', 'sourceIds'],
        properties: { rulesetId: { type: 'string' }, effectiveDate: { type: 'string', format: 'date' }, status: { enum: ['eligible_within_threshold', 'not_eligible_for_choice', 'threshold_exceeded', 'manual_review'] }, thresholdMode: { enum: ['annual', 'time_proportional'] }, annualThresholdHuf: { type: 'string' }, thresholdHuf: { type: 'string' }, registrationDate: { type: 'string', format: 'date' }, activeDays: { type: 'integer' }, daysInYear: { type: 'integer' }, thresholdExact: { type: 'object' }, choiceEligible: { type: 'boolean' }, thresholdExceededInCurrentYear: { type: 'boolean' }, checks: { type: 'object' }, values: { type: 'object' }, legalBasis: { type: 'string' }, sourceIds: { type: 'array', items: { type: 'string' } }, notice: { type: 'string' }, reason: { type: 'string' } }
      }
    }
  }
};
