# KAMIN, 48-Hour Build Plan

> Track 1, Live Map of National Capabilities.
> Read with `DATA_SOURCES.md` (every endpoint, access caveat and risk) and `SUBMISSION.md` (the pitch).
> Written for the team of three (Mohammed, Ali, Abdulaziz). Four-person split and a two-person collapse at the end.

---

## Architecture

```
   Purchase requests ─►┌─────────────────────────────────┐
   from portco ERPs    │  COORDINATOR AGENTS (per line)  │──┐
   (AR/EN free text)   │  spec + HS anchor               │  │
                       │  → POOL across companies + time │  │
                       └─────────────────────────────────┘  │
                                    │ pooled order          │
                                    ▼                       │
   Tarmeez API ───────►┌─────────────────────────────────┐  │
   MLCP (CR nums)─────►│ DETECTIVE AGENTS (per provider) │  │
   Made in Saudi ─────►│ crawl · CR · awards · certs     │  │
   Long-tail hunt ────►│ → who can serve THIS volume     │  │
                       └─────────────────────────────────┘  │
                                    │                       ▼
                       ┌─────────────────────────────────┐ ┌──────────────────┐
                       │  AUDITOR AGENTS (per claim)     │ │  CAPABILITY      │
                       │  adversarial: REFUTE this       │►│  GRAPH           │
                       │  then CLASSIFY: maker /         │ │  (persisted)     │
                       │  assembler / distributor/trader │ │                  │
                       └─────────────────────────────────┘ │  factory         │
                                                           │  ├─ capability   │
   Comtrade HS ───────►┌─────────────────────────────────┐ │  │  ├─ evidence  │
   import values       │  ADVISOR AGENTS (per gap)       │◄┤  │  ├─ class     │
                       │  pooled annual value ·adjacency │ │  │  └─ confidence│
                       │  who could pivot → investment   │ │  ├─ region       │
                       └─────────────────────────────────┘ │  └─ CR number    │
                                    │                      └──────────────────┘
                                    ▼
     VETTED PROVIDER LIST   ·   GAP LEDGER   ·   COVERAGE %
```

**Design rule:** the graph is the product. Agents write into it; the UI reads from it. A cold miss triggers a live detective that *writes back*. Never query-time-only, see the reasoning in `SUBMISSION.md`.

---

## Hour 0–2, Parallel probes (all three, no exceptions)

The single highest-risk hours. Everything downstream depends on which endpoints actually respond **from a Saudi IP**.

| Who | Task | Success looks like | If it fails |
|---|---|---|---|
| **Abdulaziz** (data) | Devtools on `psnr.mim.gov.sa/catalog/ar/factories/`. Capture the XHR. Confirm `X-Locale` + base64 `X-Api-Key` query params. Page the full catalogue. | JSON with factory + product records flowing | Fall back to rendered-HTML scrape with Playwright. **This must not fail, it is the spine.** Then probe `maps.modon.gov.sa` for an ArcGIS FeatureServer; if it is down, drop to region-level geo from Tarmeez. |
| **Mohammed** (agents) | Hit `tenders.etimad.sa` from a Saudi residential IP. | Tender + award JSON | **Do not fight the WAF.** Buy Apify `jungle_synthesizer/etimad-saudi-government-tenders-scraper` at $0.80/1k immediately. Budget ~$20. |
| **Ali** (product) | Register UN Comtrade key. Pull Saudi HS-6 imports, latest full year. Download LCGPA G1 PDF + Mandatory List. | Import values by HS + the LC formula in hand | Comtrade needs no fallback, it is the reliable one. |

**Hard rule: at hour 2, whatever responded is your data plan. Stop probing. Build with what answered.**

---

## Hour 2–8, The spine

**Graph schema** (keep it small, six node types, resist the urge to model everything):

```
Factory   { id, name_ar, name_en, cr_number?, region, geo?, source, fetched_at }
Product   { id, description_ar, description_en, hs_code?, category }
Capability{ factory_id, product_id, spec_attrs{}, confidence, status }
Evidence  { capability_id, source_url, source_type, excerpt, fetched_at }
DemandLine{ id, raw_text, portco, normalized_spec, hs_code, confidence, pool_id? }
PooledOrder{ id, hs_code, spec, qty_now, qty_annual, portco_count }
```

`cr_number` is the join key across every source. Populate it wherever available (MLCP gives it outright), it is what makes a future Wathq integration a drop-in rather than a rebuild.

**Work:**
1. Ingest Tarmeez → Factory + Product + baseline Capability (status: `declared`, confidence: low). This alone is thousands of real nodes.
2. Ingest MLCP → CR numbers, merge on name similarity, flag conflicts for review.
3. Ingest Made in Saudi via `api.saudimade.sa` (SPA, capture the XHR, the HTML shell is empty) → `certified_local` flag, ≥40% value-add rule.
4. Load Mandatory List → flag products government/state-owned entities must source locally.
5. Load Comtrade HS-6 imports → demand value per product line.
6. **Reconcile the conflicting figures now, not on stage:** Tarmeez product count (52,824 AR vs 12,641 EN), Mandatory List size (1,444 vs 233 vs 116 are three different metrics), MODON scale. Pick one citable number per claim and write it down.

7. **Coordinator spike, in parallel with the ingest.** Twenty hand-picked messy bilingual demand lines, resolved to spec and HS anchor by hand-checked agent output. This does not need the graph, so it does not wait for it. If Arabic to English normalisation cannot be made to work, the whole demo does not work, and you need to know that at hour 8, not hour 40.

**Checkpoint at hour 8:** the graph loads, is queryable, and contains real Saudi factories, and the Coordinator spike resolves at least 15 of the 20 lines. If not, cut scope somewhere else, not here.

---

## Hour 8–16, Detectives and auditors

**Detective agent**, one per candidate provider, fanned out, parallel:

```
INPUT   Factory node (name, CR, region, declared products)
TOOLS   web search · fetch · CR lookup · tender-award lookup
STEPS   1. Find and read the company's own web presence
        2. Pull awarded government contracts → what they have actually delivered
        3. Find certifications (ISO, SASO, sector-specific)
        4. Read product literature / catalogues for specifications
        5. Look for equipment, capacity, headcount signals
OUTPUT  Capability claims, each with: spec attributes, source URL,
        excerpt, source_type (primary | secondary | marketing)
RULE    Never assert a capability without an evidence record.
        Absence of evidence is a valid output. Say "unknown".
```

**Auditor agent**, one per claim, adversarial, runs immediately after its detective (pipeline, no barrier, item A can audit while item B is still being investigated):

```
INSTRUCTION  Try to REFUTE this capability claim. Default to refuted
             when uncertain.
CHECKS       Manufacturer or trading company reselling imports behind
             a Saudi CR? · Is the evidence primary or marketing copy? ·
             Does the CR activity code support the claim? · Does claimed
             capacity match observable facility scale? · Any contradicting
             source?
OUTPUT       { refuted: bool, confidence: 0-1, reasoning, killer_evidence? }
```

Run 2–3 auditors per claim with **different lenses** (is-it-real · is-it-local · is-it-at-spec) rather than three identical refuters. Diversity catches failure modes redundancy cannot. Majority refutation kills the claim.

**Scope discipline:** several hundred entities fully enriched in one or two priority sectors beats three thousand shallow rows. Pick sectors where the Mandatory List and import values are both high, that is where the gap ledger will have teeth. Say "depth over breadth, deliberately" on stage before a judge says it for you.

**Long-tail discovery** (this is the headline claim, protect the time for it): agents that hunt manufacturers appearing in *no* registry, chamber directories, trade listings, industrial-area presence, supplier mentions in tender documents. Every one found is a point of Discovery Lift.

---

## Hour 16–28, Coordinator and matching

**This is the critical technical path. If something has to slip, slip the UI, not this.**

**Coordinator agent**, one per demand line:

```
INPUT   "صمام كروي من الفولاذ المقاوم للصدأ ٢ بوصة، ضغط ٤٠ بار"
STEPS   1. Identify the object class (ball valve)
        2. Extract spec attributes (material: SS, size: 2", pressure: 40 bar)
        3. Resolve to HS anchor (8481.80)
        4. Retrieve candidate capabilities from the graph
        5. Rank by spec fit, confidence, evidence quality, region
OUTPUT  normalized_spec, hs_code, confidence, ranked candidates
```

**Arabic↔English normalisation** is the genuine technical contribution. Realistic 48h approach: embedding-based fuzzy matching of product descriptions against HS descriptions, with an LLM adjudicating ambiguity. The 20-line spike from hour 2 to 8 is what de-risks this; here it scales to the full demand set and gains pooling.

**Category-level matching is worthless.** "Valves" is not a match. Match at spec level or state that you cannot.

**Demand set construction:** synthesise realistic portfolio purchase lines, but anchor every value to genuine HS-level Saudi import data from Comtrade. Deliberately include messy cases, Arabic free text, misspellings, mixed-language lines, inconsistent units, because handling them is the point.

**Local content scoring:** implement LCGPA G1 as a real function from the published PDF. Label every score with which template and mechanism it uses (G1 entity-level vs G2.2 minimum-threshold vs G2.3 commercial-evaluation weight). Cite the document. *"Our scoring is LCGPA-methodology-aligned"* is the most defensible sentence in the whole pitch, do not weaken it with an invented formula.

---

## Hour 28–40, Gap ledger and advisors

**Advisor agent**, one per gap:

```
INPUT   Demand line with no local capability above threshold
STEPS   1. Total pooled annual value at this HS line (Comtrade/GASTAT + pooled demand)
        2. Is it on the Mandatory List? (regulatory pressure = priority)
        3. Adjacent domestic capability, who makes something near this?
        4. Which factories could pivot with existing equipment?
        5. Raw material availability (Ta'adeen / SGS layer)
OUTPUT  Ranked gap with import value, regulatory flag, pivot candidates,
        and a one-paragraph investment case
```

**Adjacency inference is the differentiator.** Nobody else will attempt it. A stainless pipe-fitting plant can make valve bodies. Reason over equipment class, material handling, process similarity and existing product adjacency, not category codes.

**Raw materials layer** (Ta'adeen + Saudi Geological Survey): even shallow, it differentiates. The brief explicitly asks for raw materials and most teams will only do finished goods.

**UI, three screens, no more:**
1. **Gap ledger** (open here), ranked table, SAR import value, regulatory flag, pivot candidates
2. **Capability map**, geographic, filterable by product/region/confidence
3. **Evidence drill-down**, one supplier claim, its full provenance chain, its confidence, its auditor verdict

Coverage percentage as a persistent header figure. It is the number PIF has never been able to state, make it impossible to miss.

---

## Hour 40–48, Rehearsal and hardening

- **The live cold-miss must be rehearsed and must have a fallback.** Pre-record it. If the stage network fails, play the recording and say so.
- **Reconcile every number** you will say out loud to one cited source.
- **Prepare the three questions you will definitely be asked:**
  1. *How is this different from MUSAHAMA?* → Registration-based platforms see only who opted in. We are outside-in. We feed you; we do not replace you.
  2. *How do I know these capabilities are real?* → Show the evidence chain. Show an auditor killing a false claim. That demo beats any answer.
  3. *Where does the data come from?* → Every source named, live-checkable. Demand is simulated because portfolio spend is confidential, anchored to real HS import values. Say it before they ask.
- **The government-access slide:** LCGPA certified-company registry, SABER product registry, customs microdata, closed today, and naming precisely what is missing and why signals seriousness to LCGPA and DGA judges.
- Freeze the graph. Demo against a snapshot with the live path as the deliberate exception.

---

## Demo script (7 minutes)

1. **The number.** "PIF portfolio companies buy X. We can tell you what share the Kingdom can supply today. Nobody has been able to state that number." *(30s)*
2. **Gap ledger.** Open on it. Ranked by import value. "These are the products PIF buys that nobody in the Kingdom makes." *(1m)*
3. **Drill into one gap.** Import value, mandatory-list flag, and four factories that could pivot into it. "This is an investment pipeline, not a report." *(1.5m)*
4. **Flip to a match.** Three messy purchase lines from three companies → one pooled order → three local providers. "Two of these are in no supplier registry, and none of them would have bid on 12 units." *(1.5m)*
5. **Evidence chain.** Click one claim. Sources, confidence, auditor verdict. Then show a claim the auditor *killed*. "This is why you can believe the other one." *(1m)*
6. **Live cold-miss.** New query, watch a verified node write itself into the graph. *(1m)*
7. **Close.** "MUSAHAMA knows who registered. KAMIN knows who never raised a hand. We are the layer underneath." *(30s)*

---

## Team split

**Three people, as we actually are:**
- **Abdulaziz Al Harthi, Data/graph + infra.** Tarmeez ingest, schema, joins, CR reconciliation, Comtrade, deployment. Owns the spine.
- **Mohammed Shalabi, Agents + critical path.** Detective and auditor fan-out, evidence capture, and the Coordinator's Arabic to English normalisation. Owns Discovery Lift and the one component everything else depends on.
- **Ali Bamuallim, Product/UI + narrative.** Three screens, gap ledger, demo, slides, question prep. Starts the deck at hour 8, not hour 44.

**If a fourth joins:** split Mohammed's role, one owns the Detective and Auditor swarm, one owns the Coordinator, resolver, ranking and LCGPA scoring. That is the natural seam, because the two halves only meet at the graph.

**Two people:** one owns data + agents, one owns Coordinator + UI; cut long-tail discovery to a hand-curated set of ten found manufacturers and be honest that it is a sample. **Never cut:** the evidence chain, the auditor kill demo, or the gap ledger. Those three are the submission.

---

## Kill list, what to cut when you are behind, in this order

1. MODON geo precision → region-level from Tarmeez
2. Raw materials layer → mention as roadmap
3. Etimad awards → capability confidence drops, everything still works
4. Map screen → the gap ledger table is the stronger artefact anyway
5. Breadth of entities → narrow to one sector

**Never cut:** evidence + confidence on every claim · one auditor kill on stage · the gap ledger · the coverage number.
