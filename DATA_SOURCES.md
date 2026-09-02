# KSA Capability Data, Source Inventory

> Research for PIF Innovate Hackathon Track 1. Scoped to what is ingestible in 48h.
> **[verified]** = fetched directly. **[unverified]** = search results only.
> Several gov hosts (`niic.gov.sa`, `industry.mim.gov.sa`, `maps.modon.gov.sa`, `ic.gov.sa`)
> failed to resolve from a datacenter IP, may be geo-restricted. Re-test from a Saudi IP.

## Population baseline

**Saudi Arabia has ~12,946 operating factories (end of 2025).** Tarmeez, the national product catalogue and the best public factory source, lists **3,153**. So **9,793 factories (76%) are absent from the national catalogue itself**, before you even get to any buyer's approved-vendor list. That delta is the addressable blind spot, and it is the single most important number in this project.
⚠️ Pin the 12,946 figure to one citable source (Ministry of Industry / NIIC industrial statistics or GASTAT) before putting it on a slide, the two counts measure different things (licensed/operating factories vs. factories with registered products), which is exactly why the gap exists.

## Headline findings

1. **Tarmeez / PSNR is the spine.** Public, no login, JSON API, product→factory→region.
2. **PIF already ships an incumbent: the MUSAHAMA Platform.** Novelty must beat or explicitly complement it.
3. **The most valuable datasets are closed** (LCGPA cert holders, SABER, ZATCA customs). No amount of crawling reaches them.

---

## Tier A, usable in 48h, no government contract

### A1. Tarmeez / PSNR, National Industrial & Mining Products Catalogue ⭐
- `https://psnr.mim.gov.sa/catalog/ar/factories/` · `https://psnr.mim.gov.sa/catalog/en/products/`
- Owner: NIIC, Ministry of Industry & Mineral Resources (National Coding Initiative).
- **[verified]** Factory directory + product directory. Factory → name, product categories, region. Product → description, factory, HS-chapter-aligned category.
- **[verified]** Arabic view: **3,153 factories / 52,824 products**. English products view: **12,641**. ⚠️ Gap unresolved, locale/filter difference or partial EN translation. Verify by paging the API.
- **[verified]** Front end passes `X-Locale` and `X-Api-Key` as **query-string params with base64 values** (`TEdfQUJPVVRfUFNOUg==` → `LG_ABOUT_PSNR`). Static non-secret front-end key → JSON directly harvestable.
- Public, no login. Filters by activity, product, 14 regions. Paginated. AR + EN.
- **Only public source linking product → classification → specific factory → region. That triple is Track 1.**
- ➜ **Superseded on 2026-09-02** by the Saudi-IP re-test table at the end of this file: the catalogue is a documented REST API with no key, and the counts above are stale.

### A2. LCGPA local content measurement methodology (public PDFs)
- G1 Baseline (entity level), GCC Baseline, G2.2 (contract, minimum LC threshold), G2.3 (contract, LC weight in commercial evaluation), all under `lcgpa.gov.sa/{en,ar}/LocalContent/Documents/`
- Index: `/en/LocalContent/Pages/Local-Content-Forms.aspx`, `/Ratio-Models.aspx`
- LC score = Saudi salaries + local goods/services procurement + local assets/depreciation + capability building (training/R&D/supplier development). Locked-formula Excel templates.
- ⚠️ **[verified]** Site root is a JS-rendered SharePoint SPA, returns only page title. **Deep-link the PDFs; don't crawl the shell.**
- **Most defensible thing in the build**, lets you claim LCGPA-aligned scoring rather than invented scoring.

### A3. LCGPA Mandatory List of National Products
- `https://lcgpa.gov.sa/ar/Regulations/DocumentsLibrary/Pages/MandatoryList.aspx`
- Products government + (now) state-owned entities **must** buy locally, plus price-preference mechanism.
- ⚠️ **Three conflicting figures, do not conflate:**
  - 1,444+ products / 16 sectors / SAR 2.3bn targeted spend **[unverified, third-party]**
  - **233 products** subject to a *minimum LC percentage* from 1 Aug 2026; further tranche (split ACs, water pumps, valves, copper wire, medical devices) from 1 Aug 2027 **[verified via SPA]**
  - 116 products added in one update **[unverified]**
- Arabic-primary. Several updates/year.
- **A government-declared list of "things that already have credible local supply."** Join to Tarmeez.

### A4. GASTAT international trade in goods (demand side)
- `https://www.stats.gov.sa/en/`, monthly imports/exports by HS code and partner, 2000→present. HS 2022; 12-digit GCC tariff structure from Jan 2025.
- ⚠️ **No documented public API.** `database.stats.gov.sa` exists, content not extractable **[unverified]**. Plan on file downloads. Monthly, ~5–6 week lag. AR + EN.
- **Imports at HS level = the localizable demand pool.**

### A5. UN Comtrade (backup for A4, has a real API)
- `https://comtradeapi.un.org`; libs `comtradeapicall` (Py), `comtradr` (R)
- **[verified]** Free key: **500 calls/day, 100,000 records/call**. No token: unlimited calls, 500 records/call. Bulk download on v2/Comtrade Plus. HS-6, back to 1960s.
- **Use Comtrade for the build; cite GASTAT as the authoritative production source.**

### A6. Madinah Chamber Local Content Platform (MLCP)
- `https://lc.mcci.org.sa/Home/Factories`
- **[verified]** Public no-login factory directory with **commercial registration numbers**, product lists, per-factory detail pages. ~37 pages (low thousands, Madinah region only). Server-rendered → trivially scrapeable. Arabic only.
- **A working proof-of-concept of exactly this idea at regional scale**, and a strong "why it must be national" slide. CR numbers are your join key.

### A7. Etimad tenders & awards
- `https://tenders.etimad.sa/Tender/AllTendersForVisitor`
- Tender ID, agency, activity classification, dates, execution location, **award status / awarded supplier / awarded value**. ~283k records **[unverified]**.
- ⚠️ **[verified] The public visitor endpoint served an F5/BIG-IP CAPTCHA, not data, from a datacenter IP.** Claims of an open unauthenticated JSON API did NOT reproduce. No official developer API exists.
- Fallbacks: **Apify** `jungle_synthesizer/etimad-saudi-government-tenders-scraper` at **$0.80/1,000 records** [verified]; `tendersalerts.com` API (`list_tenders` capped at 6 results/page); parse.bot.
- **Awards = the only public record of who actually wins Saudi public spend, revealed capability, not self-declared.**

### A8. Made in Saudi (صنع في السعودية) members directory
- `https://saudimade.sa/en/members`, certified companies + products. Rule: **≥40% value added by substantial transformation in KSA, imported materials ≤60% of manufacturing cost.** Public, product-level local content proxy. Free to join, run by Saudi Export Development Authority.
- ⚠️ **[verified] JS SPA, HTML shell returns zero records.** Data from `api.saudimade.sa`; capture the XHR or use Playwright. AR + EN.

### A9. Monshaat SME open data API
- `https://pservices.monshaat.gov.sa/BI/TaskService/OpenData/EnterprisesStatistics/{Year}/{Quarter}` **[unverified]**
- Enterprise counts by size class, employees, economic activity; geographic SME distribution. Quarterly.
- ⚠️ **Hard limit:** Monshaat policy states detailed data is never shared outside government except in aggregate with no reference to individual establishments. **No company-level SME registry. Ever.** Denominators and heatmaps only.

### A10. KAPSARC Data Portal
- `https://datasource.kapsarc.org`, **[verified]** built on **Opendatasoft** → standard REST API (`/api/explore/v2.1/catalog/datasets/...`), CSV/JSON/GeoJSON, no auth.
- **Most developer-friendly Saudi data portal found.** Your substitute when `open.data.gov.sa` blocks you.

---

## Tier B, real but gated, effortful, or thin

### B1. Wathq (واثق), MoC commercial registration API
- `https://developer.wathq.sa/en/apis`
- **[verified] Available:** CR (new legislation), trade name, status, capital, owners, managers; **CR Search** by name/activity/type/location/status; commercial contracts; MISA foreign-investment entities; National Address; **GOSI/MASDR employee info**; deeds, PoA, drug info. Sandbox + Live.
- **[verified] NOT available: no industrial licence, factory, product, or supplier API. Do not plan around one.**
- Requires developer registration; a free basic CR package is stated by MCI. Pricing not shown publicly **[unverified]**.
- **48h verdict: registration/KYC will outrun the clock. Build a Wathq *adapter slide*, not an integration. Keep CR number as your join key so it drops in later.**

### B2. MODON, industrial cities GIS
- `https://modon.gov.sa/en/Eservices/Pages/GIS.aspx`; map app reportedly `https://maps.modon.gov.sa` **[unverified, DNS did not resolve]**
- **[unverified]** "Largest data reference for factories in the Kingdom using GIS", factory search, exact coordinates, status, activities, land plots.
- ⚠️ Conflicting scale: 35 cities / 6,000+ factories vs 39 cities / 7,000+ factories / 7,900+ contracts. Both **[unverified]**.
- **If it's Esri/ArcGIS (likely), the REST FeatureServer is usually queryable directly** (`/query?where=1=1&outFields=*&f=geojson`) with no key. **High-value, high-uncertainty, probe in the first two hours.** This is the "map" in "live map".

### B3. Chambers of Commerce / certificates of origin
- 28 regional chambers under `fsc.org.sa`. ⚠️ **No unified national member directory. CoO records are not published.** CoO is a strong local-content signal and is **unobtainable**. MLCP (A6) is the exception, not the rule. Do not build a dependency.

### B4. Saudi Exporters Directory (SEDA)
- **[verified]** Requires company registration and login; product images moderated. Gated. **Made in Saudi (A8) overlaps and is open, use that.**

### B5. SABER / SASO product conformity registry
- `https://saber.sa`, Certificates of Conformity for essentially every regulated product sold in KSA. **6M products registered by end-2023 [unverified]**. Integrated with Fasah customs since Jul 2020.
- ⚠️ **Account-gated. No public API or product search.** Extremely valuable in principle (specs + certified supplier + importer-vs-manufacturer distinction), inaccessible in practice. **Name it as your top government-access ask.**

### B6. Ta'adeen (تعدين) + Saudi Geological Survey, raw materials
- `https://taadeen.sa/en`, `https://cms.taadeen.sa`, mining/exploration licences, available-mining-site inquiry; SGS **National Geological Database** (deposit type, grade, stratigraphy, structural geology, historic mining). Full NGD to licensees only. Bulk/API undocumented **[unverified]**.
- **Your only realistic public raw-materials layer, and the brief explicitly asks for raw materials. Most teams will skip this.**

### B7. Daleel (دليل), NIDLP investment platform
- `https://daleel.gov.sa`, sector pages, incentives, market insight, "Industrial Map", 7 languages. **[verified]** Server-rendered → scrapeable for sector taxonomy and localization narratives. Weak on company-level data.

### B8. Commercial B2B directories (enrichment only)
Kompass Saudi, SaudiaYP (~248k contacts **[unverified]**), D&B, Techsalerator, eWorldTrade/TradeKey/ExportHub. `saudiindustryguide.com` **[verified: only ~40–50 entries]**.
**Low signal-to-noise, self-declared, mostly traders not manufacturers. Logo/contact enrichment only.**

---

## Tier C, NOT publicly accessible (say this plainly in the pitch)

| Source | Holds | Why you can't have it |
|---|---|---|
| **open.data.gov.sa** | 11,439 datasets / 289 orgs **[unverified]**, incl. industrial sector (factories, licensed employment, investment volume, IPI) | **[verified]** CKAN `package_search` returns *"The requested URL was rejected"*, WAF block on non-browser clients. `od.data.gov.sa` **[verified]** 302s to root, breaking deep links. Plus the CKAN caveat: API returns **metadata, not data**. Manual browser downloads only, keep off the critical path. |
| **LCGPA certified-company registry** | Who holds LC certificates and at what score; Self-Declaration vs Verified; 19-month validity | **No public searchable registry.** `eservices.lcgpa.gov.sa` login-gated. **The single most valuable dataset for this use case, and it is government-access only.** |
| **Aramco iktva supplier scores** | Per-supplier ratings driving procurement terms | No public list. Only the aggregate is public: 70% target hit, **75% by 2030**. Methodology public, data not. |
| **SABIC NUSANED pipeline** | **110 qualified opportunities** across metals, renewables, medical supplies | Described in annual reports, not published as data. Entema portal participant-gated. |
| **SABER product registry** | 6M+ products | Account-gated (B5). |
| **Certificates of Origin** | Per-shipment Saudi-origin proof | Not published (B3). |
| **GOSI / Nitaqat at entity level** | Saudi headcount per establishment, a direct LC input | Only via Wathq GOSI/MASDR **with consent**. |
| **ZATCA / Fasah customs microdata** | Importer-level, HS-level import records | Not public. US bills of lading are public, that's why Panjiva/ImportYeti exist. **There is no Saudi equivalent. A genuine structural gap worth naming.** |
| **Monshaat establishment-level SME data** | Employees, revenue per SME | Excluded by policy (A9). |
| **Etimad supplier registry** | Registered government suppliers | Login-gated; only awarded suppliers appear, only post-award. |

---

## Public local-content scoring stack

Buildable entirely from public documents:

1. **LCGPA G1 (entity)**, Saudi salaries + local goods/services + local assets + capability building, over total. Baseline N.1, FY2024+.
2. **LCGPA G2.2 / G2.3 (contract)**, *minimum LC threshold* vs *LC weight in commercial evaluation*. **Support both, tenders use one or the other.**
3. **LCGPA GCC-Baseline**, GCC-origin content treatment.
4. **Mandatory List + price preference**, draft rules published on Istitlaa (`istitlaa.ncc.gov.sa`), useful for *upcoming* changes.
5. **Made in Saudi rule**, ≥40% value added, imports ≤60% of manufacturing cost. Simple, public, product-level.
6. **Aramco iktva methodology**, publicly described (value created, not purchase location). Cross-check; PIF energy/industrial portcos are iktva-exposed.
7. **LCGPA training PDFs**, `lcgpa.futurex.sa`, open, AR + EN. Exact regulatory language.

**Policy fact to cite:** LC requirements were **extended to state-owned entities**, which is exactly why PIF portfolio companies are running this hackathon.

---

## Incumbents, what Novelty has to beat

### MUSAHAMA Platform (PIF's own), read this first
- `https://musahama.pif.gov.sa/` **[verified: live]**; program pages **[verified: 403 to non-browser clients]**
- PIF's Local Content Growth Program (MUSAHAMA), four enablers: Supplier Development Program, PIF Local Content Policy, MUSAHAMA Awards, **MUSAHAMA Platform**.
- PIF's own framing: solves "fragmented sourcing opportunities, limited visibility into aggregated demand, and repetitive registration processes by creating **one unified intelligence hub**," letting PIF and **150+ portfolio companies** "discover and connect with local high-performing suppliers." Target **60% local content**. SDP spans 40+ measures.
- **Implication:** MUSAHAMA is *registration-and-engagement*. Suppliers opt in. Its blind spot is structural, **it can only see suppliers who registered.**
- **Your novelty angle: outside-in.** A no-registration-required capability graph from Tarmeez + Mandatory List + Etimad awards + trade data, surfacing capable Saudi manufacturers who have **never registered with PIF**, and quantifying localization gap per HS code. **Frame as a discovery/enrichment layer feeding MUSAHAMA. Do not pitch a supplier registration portal.**

### Saudi / regional
| Name | Does | Overlap risk |
|---|---|---|
| **MUSAHAMA (PIF)** | Supplier registration + LC analytics for the PIF ecosystem | **Very high** |
| **MLCP – Madinah Chamber** | Public regional factory/LC directory | High conceptually, tiny scope |
| **Tarmeez / NIIC** | National product↔factory catalogue | High on data, **low on product**, static catalogue, no matching, no scoring, no demand side |
| **Daleel (NIDLP)** | Investment/sector intelligence, industrial map | Medium, investor-facing |
| **Made in Saudi** | Certified local-product directory | Medium, no sourcing workflow |
| **Tenders Alerts / Bidovate / Tenderspedia / Menacon / SellToState** | Etimad monitoring, award analytics | Demand side only, no capability layer |
| **Sary / Ordro** | B2B wholesale/FMCG marketplaces | Different segment |
| **NUSANED / iktva** | Corporate LC programs | Closed |

### Global
- **Supplier discovery:** Scoutbee, TealBook (strongest data layer), Globality, Craft.co, Interos
- **Supply-chain mapping:** Z2Data (part→site, tier-1→sub-tier), Sourcemap, Resilinc, Everstream
- **Trade-data:** Panjiva (S&P), ImportYeti, Exim Trade Data, Volza
- **Prequalification:** Achilles, Avetta, ISNetworld
- **Directories:** ThomasNet, Kompass, Europages, Alibaba, Made-in-China

**Two structural gaps none of them fill, your novelty pillars:**
1. **No global player can do KSA well**, because Saudi import records are not public. Panjiva/ImportYeti's whole model is bill-of-lading data; Saudi is a blind spot.
2. **None of them speak LCGPA.** No global platform computes a G1/G2.2/G2.3-aligned score or checks Mandatory List coverage. **A hard, verifiable, Saudi-specific moat.**

---

## Suggested 48h ingest plan

**H0–2, three people in parallel:**
1. Devtools on Tarmeez factories → capture the JSON XHR, confirm `X-Api-Key`/`X-Locale`, page the catalogue. **Highest priority.**
2. Probe `maps.modon.gov.sa` from a Saudi IP for an ArcGIS FeatureServer → geocoded factories.
3. Hit Etimad from a Saudi residential IP. **CAPTCHA → immediately fall back to Apify at $0.80/1k. Do not fight the WAF.**

**H2–8, spine:** Tarmeez products (category → factory → region) as nodes/edges · Mandatory List flags · Comtrade HS-6 imports as demand value · **join on commercial registration number** wherever available.

**H8–24, differentiation:** LCGPA G1 as a real scoring function (label which template/mechanism each score uses) · Etimad awards as proven-supplier weighting · Ta'adeen/SGS raw-materials layer · Made in Saudi certified-local flag.

**H24–48, the product:** gap analysis (imports with no matching local capability) · supplier match/rank · LC impact simulation.

**Bilingual is non-negotiable.** Tarmeez, Mandatory List and MLCP are Arabic-primary; Comtrade is English-only. You need Arabic↔English product-name normalisation, embedding-based fuzzy matching against HS descriptions is the realistic 48h approach. **This is a genuine technical contribution and scores on both Feasibility and Emerging Tech.**

---

## Risk register

- **[verified]** `open.data.gov.sa` WAF-blocks programmatic clients. Off the critical path.
- **[verified]** Etimad served bot protection, not data, from a datacenter IP. The widely-repeated "open unauthenticated Etimad API" claim did not reproduce.
- **[verified]** `lcgpa.gov.sa`, `saudimade.sa/members`, PIF MUSAHAMA pages are JS-SPA or 403 to simple fetchers. Deep-link PDFs and captured XHR work; naive crawling does not.
- **[unverified]** `niic.gov.sa`, `industry.mim.gov.sa`, `maps.modon.gov.sa` did not resolve; `ic.gov.sa` failed TLS, from a datacenter IP. Could be geo-restriction. `psnr.mim.gov.sa` resolved fine, so NIIC data is reachable regardless.
- **Reconcile before citing anything on stage:** Tarmeez product count (52,824 AR vs 12,641 EN) · Mandatory List size (1,444 vs 233 vs 116, three different metrics) · MODON scale (35 vs 39 cities, 6,000+ vs 7,000+ factories).
- **The most valuable datasets are the closed ones**, LCGPA cert holders, SABER, ZATCA microdata. Name them explicitly as the "with government access this becomes 10x" slide. **LCGPA/DGA judges will respect that you know exactly what you're missing and why.**

---

---

## Re-test from a Saudi IP, 2026-09-02

Every host below was probed from Mohammed's machine in Riyadh (STC). Datacenter-IP failures recorded above are superseded by this table.

| Source | Result from a Saudi IP | What changed |
|---|---|---|
| **Tarmeez / PSNR (A1)** | **Documented REST API, no key needed.** OpenAPI spec at `https://psnr.mim.gov.sa/CatalogApi/swagger/v1/swagger.json`, base `https://psnr.mim.gov.sa/CatalogApi/api/v1/`. Plants: `factories/plants?pageIndex=&pageSize=` (pageSize 500 works, stable paging). Plant detail `factories/plants/{id}` carries **CommercialRecordNo, Location (city), Governorate (region), InvestmentType and a Products list where each line has a 12-digit tariff Symbol plus Amount and Unit, i.e. declared annual capacity**. Products: `factories/products` (59,611 product registrations, bilingual, each carrying a tariff Symbol; they collapse to 4,834 distinct tariff codes, so the catalogue's product count is registrations, not product lines). HS tree: `products/categories` (23 sections down to subheading, bilingual). Search: `products/products?searchQuery=صمام` gives 287 valve lines; `factories/plants?searchQuery=صمام` gives 18 plants. Activities (26, ISIC-like, with children), governorates (13), **`mining/companies` (40, with websites and emails)**. Swagger declares an `x-api-key` header; the server does not enforce it on GET. | The `X-Locale` / `X-Api-Key` query params in A1 belong to the portal's page links, not the catalogue API. **Counts: 14,873 plants** (`investmentTypeId=1` "National Investment" 3,635; `=3` "Mutual Investment" 11,238), not 3,153. **59,611 products**, not 52,824 or 12,641. In a 25-plant sample every plant had a CR number, none had a website, and product lines per plant ran from 0 to 47. See the population note below. |
| **MLCP (A6)** | 200, server-rendered, 332 KB, 104 links on the first page. | As documented. |
| **Made in Saudi (A8)** | Next.js front end over a **Strapi v3** backend at `api.saudimade.sa`. Anonymous `GET /members` returns 401. The front end signs every request with an `x-api-key` header computed client-side from a passphrase in its own bundle plus the current timestamp. | Ingest through a real browser (Playwright) paginating the public members page, rate-limited, rather than replicating the signing scheme. |
| **Etimad (A7)** | The visitor page loads from a Saudi IP with F5 scripts present and no CAPTCHA. **`GET /Tender/AllSupplierTendersForVisitorAsync?PageSize=24&PageNumber=n` returns JSON once a session cookie exists** (totalCount 287,870; 40 fields per tender including agency, activity and dates). Page size is capped at 24 and deep pages return 400, so enumeration must be sliced by `AgencyCode`, `SubActivityId`, `PublishDateId`, `TenderTypeId` or `MultipleSearch`. `GetMainActivitiesAsync` (21), `GetSubActivitiesAsync`, `GetAllAgenciesAsync`, `GetAreasAsync` all answer. **Award results are not reachable anonymously**; every award-style path returns nothing, and `GetSupplierInfoByCR` is commented out client-side. | The list is a demand-side and activity signal, not capability evidence. Awards still need Apify or a login. Kill-list item 3 stands. |
| **Comtrade (A5)** | **Public preview works with no key**: `https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=682&period=2024&cmdCode=848180&flowCode=M` returned 82 partner rows in 1.2 s. 500 records per call without a key. | Use the preview for the build; a free key lifts the cap. |
| **LCGPA (A2, A3)** | The site is now a **Mendix SPA** (`mxclientsystem/mxui`), not SharePoint. Every path, including the old PDF deep links and `_api/` REST, returns the shell or a WAF rejection. Documents live at `https://lcgpa.gov.sa/p/ar_SA/MandatoryListNationalProducts/Documents` inside the app. The training platform `lcgpa.futurex.sa` hosts the G1 guideline and the Mandatory List PDF but requires a login (403 anonymously). Third-party copies of G1 v5.0 (15 Nov 2022) exist on Scribd and Studocu. | A human downloads the PDFs in a browser (Ali, per the plan) and commits them under `docs/sources/`. The G1 formula is implemented from the guideline's published structure, input-gated. |
| **LCGPA Mandatory List size** | The 2026 expansion reported by SPA (`spa.gov.sa/N2644643`) and local press: **965 products across 14 sectors** now carry minimum local-content percentages. | A fourth figure next to 1,444 / 233 / 116. Reconcile before citing any of them. |
| **MODON GIS (B2)** | `maps.modon.gov.sa` resolves to a CNAME but does not answer from a Saudi IP either. | Kill-list item 1 applied: region and city come from Tarmeez. |
| **NIIC / industry.mim.gov.sa** | No A record from a Saudi resolver. | Dead hostnames, not geo-blocking. |
| **open.data.gov.sa** | WAF "Request Rejected" with a browser UA from a Saudi IP. | Off the critical path, as documented. |
| **KAPSARC (A10), Wathq portal, Ta'adeen, MUSAHAMA, Daleel** | All 200. Ta'adeen is server-rendered (170 KB). | As documented. |

**Population note (supersedes the baseline at the top of this file).** The catalogue API lists 14,873 plants, more than the 12,946 "operating factories" the deliverables cite. Either the catalogue includes licensed but non-operating plants and traders that registered product lines (the first plant in the default listing is a trading company), or 12,946 measures a different population. Until InvestmentType and the 12,946 source are pinned, **the "3,153 of 12,946, 76% absent" claim is unsupported and must not be said on stage.** The defensible blind spot is different and still strong: the catalogue is self-declared, coarse (a tariff line and a tonnage, no specification) and carried no web presence for any sampled plant, so it says who registered a product line, not what anyone can supply to specification.

## Key links

**Core data:** [Tarmeez factories](https://psnr.mim.gov.sa/catalog/ar/factories/) · [Tarmeez products](https://psnr.mim.gov.sa/catalog/en/products/) · [MLCP factories](https://lc.mcci.org.sa/Home/Factories) · [Made in Saudi members](https://saudimade.sa/en/members) · [KAPSARC portal](https://datasource.kapsarc.org) · [Comtrade API](https://github.com/uncomtrade/comtradeapicall) · [GASTAT](https://www.stats.gov.sa/en/)

**Local content:** [LCGPA Local Content](https://lcgpa.gov.sa/en/LocalContent/Pages/default.aspx) · [G1 Baseline PDF](https://lcgpa.gov.sa/en/LocalContent/Documents/Guidelines%20for%20the%20Local%20Content%20Score%20Template%20(Baseline%20%20Template%20No.%20N.1)%20G1.pdf) · [Mandatory List](https://lcgpa.gov.sa/ar/Regulations/DocumentsLibrary/Pages/MandatoryList.aspx) · [SPA: minimum LC percentages](https://www.spa.gov.sa/en/N2514218) · [LC extended to state-owned entities](https://dgagroup.com/insight/asg-analysis-saudi-arabia-extends-local-content-requirements-state-owned-entities/) · [Istitlaa price preference](https://istitlaa.ncc.gov.sa/ar/Finance/lcgpa/PricePreferenceMechanismforNationalProducts/Pages/default.aspx)

**Incumbent:** [MUSAHAMA Platform](https://musahama.pif.gov.sa/) · [PIF Local Content Growth Program PDF](https://www.pif.gov.sa/-/media/project/pif-corporate/pif-corporate-site/private-sector-hub/our-program/pdf/local-content-growth-program-english.pdf)

**Gated/other:** [Wathq APIs](https://developer.wathq.sa/en/apis) · [Etimad](https://tenders.etimad.sa/Tender/AllTendersForVisitor) · [Apify Etimad scraper](https://apify.com/jungle_synthesizer/etimad-saudi-government-tenders-scraper) · [MODON GIS](https://modon.gov.sa/en/Eservices/Pages/GIS.aspx) · [Ta'adeen](https://taadeen.sa/en) · [Daleel](https://daleel.gov.sa/ar?lang=ar) · [Monshaat open data](https://www.monshaat.gov.sa/en/node/12768) · [Aramco iktva](https://www.aramco.com/en/what-we-do/commercial-ecosystems/iktva) · [SABIC Nusaned](https://www.sabic.com/en/nusaned/nusaned-initiative)

---

## Provenance

- Compiled 2026-08-24 by a background research agent for PIF Innovate Hackathon Track 1.
- Method: live web fetches + search across Saudi government portals, statistics authorities, corporate localization programs, and competing commercial platforms. 66 tool invocations, ~80k tokens, ~12 min wall clock.
- Every claim is tagged **[verified]** (fetched directly during research) or **[unverified]** (search results / third-party pages only). Nothing here is speculation; unverified items are flagged rather than dropped so they can be re-tested from a Saudi IP.
- Known limitation: research ran from a datacenter IP outside KSA. Geo-restriction, DNS filtering and WAF bot-protection produced several failures that are **not** proof the sources are down. Re-test the flagged hosts locally before ruling anything out.
- Companion file: `PIF_HACKATHON.md` (the hackathon brief itself).
