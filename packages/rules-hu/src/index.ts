export const HUNGARY_VAT_RULESET = {
  id: 'HU-VAT-2026-001',
  jurisdiction: 'HU',
  validFrom: '2026-01-01',
  verifiedThrough: '2026-09-01',
  rates: [
    {
      rate: 27,
      kind: 'standard',
      legalBasis: 'Áfa tv. 82. § (1)',
      sourceId: 'HU-AFA-TV-82-1'
    },
    {
      rate: 18,
      kind: 'reduced',
      legalBasis: 'Áfa tv. 82. § (3), 3/A. számú melléklet',
      sourceId: 'HU-AFA-TV-82-3'
    },
    {
      rate: 5,
      kind: 'reduced',
      legalBasis: 'Áfa tv. 82. § (2), 3. számú melléklet',
      sourceId: 'HU-AFA-TV-82-2'
    }
  ],
  sources: [
    {
      id: 'HU-AFA-TV-82-1',
      authority: 'Nemzeti Jogszabálytár',
      title: '2007. évi CXXVII. törvény az általános forgalmi adóról — 82. § (1)',
      url: 'https://njt.hu/jogszabaly/2007-127-00-00'
    },
    {
      id: 'HU-AFA-TV-82-2',
      authority: 'Nemzeti Jogszabálytár',
      title: '2007. évi CXXVII. törvény az általános forgalmi adóról — 82. § (2), 3. számú melléklet',
      url: 'https://njt.hu/jogszabaly/2007-127-00-00'
    },
    {
      id: 'HU-AFA-TV-82-3',
      authority: 'Nemzeti Jogszabálytár',
      title: '2007. évi CXXVII. törvény az általános forgalmi adóról — 82. § (3), 3/A. számú melléklet',
      url: 'https://njt.hu/jogszabaly/2007-127-00-00'
    }
  ]
} as const;

function assertSupportedDate(effectiveDate: string): void {
  if (effectiveDate < HUNGARY_VAT_RULESET.validFrom) {
    throw new Error(`No Hungary VAT ruleset is loaded before ${HUNGARY_VAT_RULESET.validFrom}.`);
  }

  if (effectiveDate > HUNGARY_VAT_RULESET.verifiedThrough) {
    throw new Error(`Rules are verified only through ${HUNGARY_VAT_RULESET.verifiedThrough}. Refresh regulatory sources before using a later date.`);
  }
}

export function getHungaryVatRates(effectiveDate: string) {
  assertSupportedDate(effectiveDate);

  return {
    rulesetId: HUNGARY_VAT_RULESET.id,
    jurisdiction: HUNGARY_VAT_RULESET.jurisdiction,
    effectiveDate,
    verifiedThrough: HUNGARY_VAT_RULESET.verifiedThrough,
    rates: HUNGARY_VAT_RULESET.rates,
    sources: HUNGARY_VAT_RULESET.sources,
    classificationSupported: false,
    notice: 'Rates are exposed with legal-source metadata. Automatic product/service VAT classification is not implemented yet.'
  };
}
