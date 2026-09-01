# Regulatory source register

Last Phase 1 review: **2026-09-01**.

This file is an index, not a substitute for reading the current consolidated legal text before implementing or changing a production rule.

## European Union — ViDA

### European Commission

- VAT in the Digital Age overview: https://taxation-customs.ec.europa.eu/taxation/vat/vat-digital-age-vida_en
- 2026 ViDA work programme announcement: https://taxation-customs.ec.europa.eu/news/vat-digital-age-2026-work-programme-available-2026-05-22_en

### Legal acts

- Council Directive (EU) 2025/516: https://eur-lex.europa.eu/eli/dir/2025/516/oj
- Council Regulation (EU) 2025/517: https://eur-lex.europa.eu/eli/reg/2025/517/oj
- Council Implementing Regulation (EU) 2025/518: https://eur-lex.europa.eu/eli/reg_impl/2025/518/oj

## Hungary — VAT

### Primary legislation

- 2007. évi CXXVII. törvény az általános forgalmi adóról — official NJT ELI current HTML: https://njt.jog.gov.hu/eli/TV/2007/127/hu/html

Relevant Phase 1 provisions include:

- 55–59. § — tax point / performance and advance-payment foundations;
- 58. § — periodic settlement/payment transactions;
- 82. § (1) — 27% standard rate;
- 82. § (2) and Annex 3 — 5% reduced rate;
- 82. § (3) and Annex 3/A — 18% reduced rate;
- 85. § — public-interest activity exemptions, including supported healthcare, dental and education cases and regulatory permit/qualification conditions;
- 86. § — specific-nature exemptions, including supported insurance, credit/payment/financial services, property rental and property sales; the property-sale evaluator models j)–k), including ja)–jc) and building-plot exceptions;
- 88. § — option to make otherwise exempt property transactions taxable, with the current MVP modelling separate sale/rental elections and non-residential-only scope;
- 142. § — domestic reverse-charge cases and conditions, including supported construction and §88-elected property-sale paths;
- 188. § — domestic small-business VAT exemption turnover threshold and turnover-value basis;
- 189. § — election and time-proportional threshold condition for taxpayers registering during the tax year.

### NAV guidance used by the Phase 1 rules

- 2026 information booklets: https://nav.gov.hu/ugyfeliranytu/nezzen-utana/inf_fuz/2026
- 2026/1 tax question on products subject to the 18% VAT rate: https://nav.gov.hu/ado/adozasi_kerdes/20261.-adozasi-kerdes---a-18-os-afakulcs-ala-tartozo-termekekrol
- 2026/2 tax question on qualifying cattle products subject to the 5% rate: https://nav.gov.hu/ado/adozasi_kerdes/2026_2._Adozasi_kerdes_-_A_haziasitott_szarvasmarha_elelmezesi_celra_alkalmas_husa_vagasi_mellektermeke_es_belsosege_ertekesitesenek_5_-os_adomertekerol
- 2026/4 tax question on permit/notification conditions for domestic construction reverse charge: https://nav.gov.hu/ado/adozasi_kerdes/20264.-adozasi-kerdes---hatosagi-engedelyhez-es-bejelenteshez-kotottsegre-vonatkozo-feltetel-a-belfoldi-forditott-adozas-ala-tartozo-ugyletek-eseteben
- 0% daily-newspaper VAT rate from 2024: https://nav.gov.hu/ado/afa/Uj_0_-os_adomertek_a_szamlaadat-szolgaltatasban_2024-tol
- 0% qualifying prescription / human magistral medicine guidance effective from 2026-09-01: https://nav.gov.hu/print/ado/afa/Tajekoztato_a_venykoteles_gyogyszerek_adomertekerol
- periodic-settlement guidance: https://nav.gov.hu/pfile/file?path=%2Fado%2Fafa%2FTajekoztato_-_Idoszakos_elszamolasu_ugyletekre_vonatkozo_szabalyozas_valtozasa
- 2026 small-business VAT exemption threshold guidance: https://nav.gov.hu/ado/afa/Emelkedik_az_alanyi_adomentesseg_ertekhatara
- 2026 NAV information booklet on property rental, confirming the §86 property-rental exemption, §86 (2) exceptions, §88 taxation-election choices and the time-proportional AAM principle for a taxpayer starting during the year: https://nav.gov.hu/pfile/file?path=%2Fugyfeliranytu%2Fnezzen-utana%2Finf_fuz%2F2026%2F10.-Ingatlan-berbeadasanak-es-egyeb-hasznositasanak-adozasa-2026.02.03
- 2023/8 tax question, reproducing and applying the current §86 (1) j) ja)–jc) built-property tests: https://nav.gov.hu/ado/adozasi_kerdes/2023-8_-_Berelt_ingatlanon_vegzett_beruhazassal_kapcsolatos_egyes_afakerdesek
- NAV guidance on §88 property-sale/rental taxation elections and the five-year lock-in: https://nav.gov.hu/ado/afa/ingatlan_121220
- NAV guidance on §142 (1) e) reverse charge for otherwise exempt property sales made taxable by election: https://nav.gov.hu/print/ado/afa/afa_ingatlan_120524

## Exemption implementation boundary

The first §85–86 evaluator is intentionally bounded. It automates only fact patterns whose statutory conditions are represented in the input model. In particular:

- supported healthcare/dental/education cases retain the §85 (3) permit/qualification guards;
- public-service-provider definitions and every §85 category are not yet fully modelled;
- supported insurance/credit/payment cases do not imply that every financial service is exempt;
- debt collection and portfolio management are explicitly prevented from being treated as exempt through the supported payment/financial path;
- a result of `not_exempt_under_supported_rule` never means “27% automatically”; another exemption, rate or treatment may still require classification;
- AAM is a separate taxpayer-level overlay and is not silently mixed into activity-specific property-rental or property-sale decisions;
- property-sale exemption/taxability is kept separate from VAT-rate classification and the person liable for VAT;
- mandatory-taxable new property and building plots are not routed through the §142 (1) e) reverse-charge path, which applies to §86 (1) j)–k) transactions made taxable by a §88 election.

## Property-sale implementation convention

For built property, the API treats the sale as mandatorily taxable under the supported §86 (1) j) path when:

- first intended use has not occurred;
- the sale is before the second calendar anniversary of the legally relevant first-occupancy permit, acknowledgement or authority-certificate date; or
- a qualifying purpose or independent-unit-count change has occurred and the sale is before the second calendar anniversary of its authority-certificate date.

On the second anniversary itself, the statutory wording “two years have not yet elapsed” no longer applies in this evaluator. Calendar-year addition clamps leap-day evidence dates to the last valid day of the target February.

For undeveloped property, the caller must confirm whether the land meets the statutory building-plot classification. A building plot is mandatory-taxable under the supported rule; other undeveloped property is activity-exempt unless a confirmed applicable §88 election overrides that exemption.

## AAM §189 implementation convention

For the current deterministic 2026 implementation, the API prorates the 20,000,000 HUF annual threshold over calendar days from `registrationDate` through 31 December, inclusive. Eligibility comparisons use the exact rational amount (`20,000,000 × activeDays / daysInYear`), not a rounded daily rate or rounded display threshold.

`thresholdHuf` in API responses is the whole-forint floor of that exact fraction for display/audit convenience only. The legal decision uses integer cross-products, avoiding a software-created rounding rule at the boundary.

If the caller cannot confirm that turnover values have already been calculated according to Áfa tv. 188. §, the evaluator fails closed with `manual_review` rather than deriving statutory exclusions from incomplete raw facts.

## Important 2026-09-01 change

The Hungary rate catalogue must include **0%**. The zero rate existed before September 2026 for qualifying daily newspapers, and its scope expanded on **2026-09-01** to qualifying prescription medicines and human-use magistral medicines under the conditions described by NAV.

Therefore `0%` is a rate in the catalogue, while **eligibility is separately classified by effective date and transaction/product facts**.

## Source policy

For production rules, prefer sources in this order:

1. current consolidated legislation / EU legal act;
2. official tax authority guidance;
3. official implementation specifications;
4. secondary professional sources only as supporting interpretation.

Each code rule should identify which authoritative source supports it and when that source was last verified. Unsupported inference is not allowed: uncertain classification should fail closed or require manual review.
