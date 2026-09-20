export const OSA_ADAPTER_VERSION = '0.1.0' as const;
export const OSA_SCHEMA_VERSION = '3.0' as const;
export const OSA_INVOICE_DATA_NAMESPACE = 'http://schemas.nav.gov.hu/OSA/3.0/data' as const;
export const OSA_OFFICIAL_SCHEMA_COMMIT = 'cc7a775d6dce361311e409abb9934eb755f2749c' as const;
export const OSA_OFFICIAL_INVOICE_DATA_XSD =
  `https://github.com/nav-gov-hu/Online-Invoice/blob/${OSA_OFFICIAL_SCHEMA_COMMIT}/src/schemas/nav/gov/hu/OSA/invoiceData.xsd` as const;
