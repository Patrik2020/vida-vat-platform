import type { RegulatorySource } from './types.js';

export const REGULATORY_SOURCES: readonly RegulatorySource[] = [
  {
    id: 'HU-AFA-ACT',
    jurisdiction: 'HU',
    authority: 'Nemzeti Jogszabálytár',
    title: '2007. évi CXXVII. törvény az általános forgalmi adóról',
    url: 'https://njt.jog.gov.hu/eli/TV/2007/127/hu/html',
    kind: 'legislation',
    impactAreas: ['hu-vat-core', 'rates', 'exemptions', 'reverse-charge', 'tax-point', 'invoicing'],
    mustContain: ['2007. évi CXXVII. törvény', 'általános forgalmi adó'],
    minimumNormalizedCharacters: 5000
  },
  {
    id: 'HU-NAV-VAT-INDEX',
    jurisdiction: 'HU',
    authority: 'Nemzeti Adó- és Vámhivatal',
    title: 'NAV – Általános forgalmi adó',
    url: 'https://nav.gov.hu/ado/afa',
    kind: 'discovery_feed',
    impactAreas: ['hu-vat-guidance', 'rates', 'exemptions', 'reporting', 'invoicing'],
    mustContain: ['Általános forgalmi adó'],
    minimumNormalizedCharacters: 500
  },
  {
    id: 'HU-NAV-INFO-2026',
    jurisdiction: 'HU',
    authority: 'Nemzeti Adó- és Vámhivatal',
    title: 'NAV – 2026. évi információs füzetek',
    url: 'https://nav.gov.hu/ugyfeliranytu/nezzen-utana/inf_fuz/2026',
    kind: 'discovery_feed',
    impactAreas: ['hu-vat-guidance', 'taxpayer-guidance'],
    mustContain: ['2026'],
    minimumNormalizedCharacters: 300
  },
  {
    id: 'EU-VIDA-OVERVIEW',
    jurisdiction: 'EU',
    authority: 'European Commission – DG TAXUD',
    title: 'VAT in the Digital Age (ViDA)',
    url: 'https://taxation-customs.ec.europa.eu/taxation/vat/vat-digital-age-vida_en',
    kind: 'implementation',
    impactAreas: ['vida', 'drr', 'e-invoicing', 'svr', 'platform-economy'],
    mustContain: ['VAT in the Digital Age', 'Digital Reporting Requirements'],
    minimumNormalizedCharacters: 1500
  },
  {
    id: 'EU-VIDA-DIR-2025-516',
    jurisdiction: 'EU',
    authority: 'EUR-Lex',
    title: 'Council Directive (EU) 2025/516',
    url: 'https://eur-lex.europa.eu/eli/dir/2025/516/oj',
    kind: 'legislation',
    impactAreas: ['vida', 'vat-directive', 'drr', 'e-invoicing', 'svr'],
    mustContain: ['2025/516', 'VAT rules for the digital age'],
    minimumNormalizedCharacters: 5000
  },
  {
    id: 'EU-VIDA-REG-2025-517',
    jurisdiction: 'EU',
    authority: 'EUR-Lex',
    title: 'Council Regulation (EU) 2025/517',
    url: 'https://eur-lex.europa.eu/eli/reg/2025/517/oj',
    kind: 'legislation',
    impactAreas: ['vida', 'administrative-cooperation', 'drr'],
    mustContain: ['2025/517'],
    minimumNormalizedCharacters: 3000
  },
  {
    id: 'EU-VIDA-IMPL-2025-518',
    jurisdiction: 'EU',
    authority: 'EUR-Lex',
    title: 'Council Implementing Regulation (EU) 2025/518',
    url: 'https://eur-lex.europa.eu/eli/reg_impl/2025/518/oj',
    kind: 'legislation',
    impactAreas: ['vida', 'implementation', 'vat-schemes'],
    mustContain: ['2025/518'],
    minimumNormalizedCharacters: 3000
  }
] as const;
