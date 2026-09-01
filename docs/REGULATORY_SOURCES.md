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

- 2007. évi CXXVII. törvény az általános forgalmi adóról: https://njt.hu/jogszabaly/2007-127-00-00

Relevant Phase 1 provisions include:

- 55–59. § — tax point / performance and advance-payment foundations;
- 58. § — periodic settlement/payment transactions;
- 82. § (1) — 27% standard rate;
- 82. § (2) and Annex 3 — 5% reduced rate;
- 82. § (3) and Annex 3/A — 18% reduced rate;
- 85–86. § — major activity-based exemption categories;
- 142. § — domestic reverse-charge cases and conditions.

### NAV guidance used by the Phase 1 rules

- 2026 information booklets: https://nav.gov.hu/ugyfeliranytu/nezzen-utana/inf_fuz/2026
- 2026/1 tax question on products subject to the 18% VAT rate: https://nav.gov.hu/ado/adozasi_kerdes/20261.-adozasi-kerdes---a-18-os-afakulcs-ala-tartozo-termekekrol
- 2026/2 tax question on qualifying cattle products subject to the 5% rate: https://nav.gov.hu/ado/adozasi_kerdes/2026_2._Adozasi_kerdes_-_A_haziasitott_szarvasmarha_elelmezesi_celra_alkalmas_husa_vagasi_mellektermeke_es_belsosege_ertekesitesenek_5_-os_adomertekerol
- 2026/4 tax question on permit/notification conditions for domestic construction reverse charge: https://nav.gov.hu/ado/adozasi_kerdes/20264.-adozasi-kerdes---hatosagi-engedelyhez-es-bejelenteshez-kotottsegre-vonatkozo-feltetel-a-belfoldi-forditott-adozas-ala-tartozo-ugyletek-eseteben
- 0% daily-newspaper VAT rate from 2024: https://nav.gov.hu/ado/afa/Uj_0_-os_adomertek_a_szamlaadat-szolgaltatasban_2024-tol
- 0% qualifying prescription / human magistral medicine guidance effective from 2026-09-01: https://nav.gov.hu/print/ado/afa/Tajekoztato_a_venykoteles_gyogyszerek_adomertekerol
- periodic-settlement guidance: https://nav.gov.hu/pfile/file?path=%2Fado%2Fafa%2FTajekoztato_-_Idoszakos_elszamolasu_ugyletekre_vonatkozo_szabalyozas_valtozasa
- 2026 small-business VAT exemption threshold guidance: https://nav.gov.hu/ado/afa/Emelkedik_az_alanyi_adomentesseg_ertekhatara

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
