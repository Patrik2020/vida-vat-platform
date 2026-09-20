/**
 * Version-specific prototype overlays. These are deliberately not presented as
 * complete upstream code lists; production validation must execute the pinned
 * official Schematron bundle from the manifest.
 */
export const PINT_EU_1_1_1_CODE_LIST_OVERLAY = Object.freeze({
  snapshot: 'PINT-EU-1.1.1-2026-06-09',
  currency: {
    explicitlyAdded: new Set(['CNH', 'XCG']),
    explicitlyRemoved: new Set(['ANG', 'BGN', 'CUC']),
  },
  invoiceType: {
    explicitlyRemoved: new Set(['502', '503']),
  },
  vatCategory: new Set(['S', 'Z', 'E', 'AE', 'K', 'G', 'O', 'L', 'M', 'B']),
});

export function isPrototypeCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value) && !PINT_EU_1_1_1_CODE_LIST_OVERLAY.currency.explicitlyRemoved.has(value);
}

export function isPrototypeInvoiceTypeCode(value: string): boolean {
  return /^\d{3}$/.test(value) && !PINT_EU_1_1_1_CODE_LIST_OVERLAY.invoiceType.explicitlyRemoved.has(value);
}
