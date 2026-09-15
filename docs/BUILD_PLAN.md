# KAMIN, 48-Hour Build Plan

> Track 1, Live Map of National Capabilities.
> Read with `DATA_SOURCES.md` (every endpoint, access caveat and risk), `docs/submission/SUBMISSION.md` (the pitch), `CONTEXT.md` (the glossary, canonical names) and `docs/adr/` (engineering decisions).
> Written for the team of three (Mohammed, Ali, Abdulaziz). Four-person split and a two-person collapse at the end.
> Decided 2026-09-02: the window is weeks away and pre-building is allowed, so the hour numbers are a build order, not a clock. Code is written by Claude Code in this repo; the three own what a human must do.

---

## Architecture

```
   MUSAHAMA + portco ─►┌─────────────────────────────────┐
   vendor masters      │  INCUMBENT LOAD (layer 0)       │──┐
   + engagements       │  buyer-attested, tier 0         │  │
                       └─────────────────────────────────┘  │
                                                            │
   Purchase requests ─►┌─────────────────────────────────┐  │
   from portco ERPs    │  COORDINATOR AGENTS (per line)  │──┤
   (AR/EN free text)   │  spec + HS anchor               │  │
                       │  → POOL across companies + time │  │
                       └─────────────────────────────────┘  │
                                    │ pooled order          │
                                    ▼                       │
                       ┌─────────────────────────────────┐  │
                       │  AUDITOR, request audit         │  │
                       │  portco bars: lead time,        │──┤
                       │  standards, class → fit         │  │
                       └─────────────────────────────────┘  │
   Tarmeez API ───────►┌─────────────────────────────────┐  │
   MLCP (CR nums)─────►│ DETECTIVE AGENTS (per supplier) │  │
   Made in Saudi ─────►│ crawl · CR · awards · certs     │  │
   Long-tail hunt ────►│ → who can serve THIS volume     │  │
                       └─────────────────────────────────┘  │
                                    │                       ▼
                       ┌─────────────────────────────────┐ ┌──────────────────┐
                       │  AUDITOR, capability audit      │ │  CAPABILITY      │
                       │  adversarial: REFUTE this       │►│  GRAPH           │
                       │  CLASSIFY + assign UNSPSC       │ │  (persisted)     │
                       │  maker/assembler/dist./trader   │ │                  │
                       └─────────────────────────────────┘ │  supplier        │
                                                           │  ├─ capability   │
   Comtrade HS ───────►┌─────────────────────────────────┐ │  │  ├─ class     │
   import values       │  ADVISOR AGENTS (per gap)       │◄┤  │  ├─ evidence  │
                       │  ladder: buy · split · invest · │ │  │  ├─ unspsc    │
                       │  partner · localise · import    │ │  │  └─ lead time │
                       └─────────────────────────────────┘ │  └─ CR number    │
                                    │                      └──────────────────┘
                                    ▼
                       ┌─────────────────────────────────┐
                       │  OUTREACH CASCADE               │──► MUSAHAMA
                       │  email 5d → whatsapp 3d → voice │    registration
                       └─────────────────────────────────┘
                                    │
                                    ▼
  VETTED LIST · OPTION LADDER · GAP LEDGER · COVERAGE (incumbent vs map)
```

**Design rule:** the graph is the product. Agents write into it; the UI reads from it. A cold miss triggers a live detective that *writes back*. Never query-time-only, see the reasoning in `docs/submission/SUBMISSION.md`.

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

**Graph schema** (eleven node types; the last four are the reshape, and every change is additive). Names are fixed in `CONTEXT.md`: Supplier, never Factory; class lives on the Capability; every Evidence carries a tier; the Auditor's verdict is supported or refuted; Run is the trajectory store (ADR 0003):

```
Supplier   { id, name_ar, name_en, cr_number?, region, geo?, layer 0|1|2,
             in_musahama, in_portco_master, in_tarmeez, in_made_in_saudi, in_mlcp,
             in_hrsd, in_moc, in_sca, source, fetched_at }
Product    { id, description_ar, description_en, hs_code?, category }
Capability { supplier_id, product_id, spec_attrs{}, class, verdict, confidence, status,
             unspsc_{segment,family,class}?, lead_time_days?, lead_time_source? }
Evidence   { capability_id, tier (0-4), visibility, source_url, excerpt, fetched_at }
DemandLine { id, raw_text, portco, normalized_spec, hs_code, confidence, pool_id?,
             required_lead_time_days?, quality_standards[] }
PooledOrder{ id, hs_code, spec_envelope, qty_now, qty_annual, portco_count, volume_status }
Run        { id, role, mode, input_ref, model, steps[], started_at, finished_at }
Engagement { id, supplier_id, portco, status, description, lead_time_days_actual?, source }
PortcoPref { portco, unspsc_family?, max_lead_time_days?, required_standards[], min_class? }
Option     { pooled_order_id, rung 1-6, state, answer?, supplier_id?, economics }
Outreach   { supplier_id, stage 1-3, sent_at, responded_at?, outcome, cost_usd }
```

**Tier 0 is new and it is why the ladder goes to zero, not one:** a portco's own record that a supplier delivered is stronger evidence than any public source, and it is private to the portfolio, hence `visibility`. The change is safely additive because the ladder already reads "lower is stronger", so every existing `tier <= 2` test admits Tier 0 correctly without being touched.

**The spec envelope needs new arithmetic.** Attributes intersect, but lead time is **tightest-wins** (a pool of a 30-day and a 90-day line demands 30) and standards are a **union** (a pool needing ISO 9001 and API 6D demands both). Getting this backwards silently produces orders that look servable and are not, so it is tested before anything else in the reshape is built.

`cr_number` is the join key across every source. Populate it wherever available (MLCP gives it outright), it is what makes a future Wathq integration a drop-in rather than a rebuild.

**Stack (decided 2026-09-02, reasoning in `docs/adr/`):** TypeScript end to end. LangGraph.js for the agent runtimes, with a registry that maps each role to a provider and model from the environment: Ollama first (`qwen3.5:9b` default; the spike A/Bs `qwen3:8b`, and ALLaM and Cohere's Arabic Command R7B remain to try), switchable per role to Claude, OpenAI or DeepSeek. `bge-m3` through Ollama for embeddings. Postgres with pgvector in Docker holds the graph, the vectors, the pg-boss job queue and the LangGraph checkpoints. Every run's trajectory is written to Postgres and streamed to the terminal; Langfuse self-hosted is the dev trace viewer. Tavily is the Detective's search tool. Next.js for the three screens. In code, agent workflows are called runs, never graphs.

**Work:**
1. **Incumbent load, before any public source.** MUSAHAMA records, portco vendor masters and engagement history: the map's starting population, and the only Tier 0 evidence there is. Reconcile on commercial registration number and expect the messiest matching in the project here, because vendor masters carry trade names and typos, not clean CRs. Keep `approved_not_used` distinct from an active supplier or the baseline is overstated.
2. Ingest Tarmeez → Supplier + Product + baseline Capability (class: manufacturer, verdict: pending, one Tier 2 evidence each). This alone is thousands of real nodes.
3. Ingest MLCP → CR numbers, merge on name similarity, flag conflicts for review.
4. Ingest Made in Saudi via `api.saudimade.sa` (SPA, capture the XHR, the HTML shell is empty) → `certified_local` flag, ≥40% value-add rule.
5. Load Mandatory List → flag products government/state-owned entities must source locally.
6. Load Comtrade HS-6 imports → demand value per product line.
7. **Reconcile the conflicting figures now, not on stage:** Tarmeez product count (52,824 AR vs 12,641 EN), Mandatory List size (1,444 vs 233 vs 116 are three different metrics), MODON scale. Pick one citable number per claim and write it down.

8. **Coordinator spike, in parallel with the ingest.** Twenty hand-picked messy bilingual demand lines, resolved to spec and HS anchor by hand-checked agent output. This does not need the graph, so it does not wait for it. If Arabic to English normalisation cannot be made to work, the whole demo does not work, and you need to know that at hour 8, not hour 40.

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
OUTPUT  Capabilities, each with: spec attributes, a class guess, and
        evidence records carrying source URL, excerpt and tier
        (1 third-party verified · 2 official registry · 3 self-published
         · 4 inferred, never standing alone)
RULE    Never assert a capability without an evidence record.
        Absence of evidence is a valid output. Say "unknown".
```

**Auditor, capability audit**, one per claim, adversarial, runs immediately after its detective (pipeline, no barrier, item A can audit while item B is still being investigated):

```
INSTRUCTION  Try to REFUTE this capability. Default to refuted when
             uncertain whether it is real or at specification. Being a
             trader is never grounds for refutation: classify it.
LENSES       is-it-real: dead CR? no such product? contradicting source?
             is-it-at-spec: category-level only? size, material, rating?
             is-it-local: manufacturer / assembler / authorised
             distributor / trader, from CR activity, facility scale,
             brand ownership
OUTPUT       { verdict: supported | refuted, class, unspsc: {segment, family, class},
               confidence: 0-1,
               reasoning, killer_evidence? }
```

Run the three lenses as separate auditors rather than one. The real and spec lenses can refute; the local lens only classifies. Only a refuted real lens kills the capability, which is the auditor-kill moment in demo step 5; a refuted spec lens strips the unsubstantiated attributes and keeps the product at category level. A capability counts toward coverage only when supported **and** backed by at least one Tier 1 or Tier 2 evidence; Tier 3-only support stays on the supplier as unverified and is queued for the next Detective pass.

**Built and measured (2026-09-02):** `bun run swarm` runs the Detectives then the Auditors over the slice, resumable; `bun run hunt` finds suppliers in no registry and investigates them. On `qwen3.5:9b`: 60 Detectives in 93 minutes, 279 audits in 168 minutes, 17 suppliers discovered of which 13 supported. Findings without an HS guess anchor to the declared line or a sector subheading; the host of a page decides its evidence tier; only a refuted real lens kills. Figures in `docs/numbers.md`.

**Scope discipline:** several hundred entities fully enriched in one or two priority sectors beats three thousand shallow rows. **Chosen slice: valves, pumps and pipe fittings** (HS 8481, 8413, 7307). It is the running example in every deliverable, it sits on the Mandatory List's August 2027 tranche, imports are large, and adjacency is natural: a fittings plant can make valve bodies. Say "depth over breadth, deliberately" on stage before a judge says it for you.

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
OUTPUT  normalized_spec, hs_code, confidence, the pooled order's
        spec_envelope, ranked candidates
```

**Arabic↔English normalisation** is the genuine technical contribution. Realistic 48h approach: embedding-based fuzzy matching of product descriptions against HS descriptions, with an LLM adjudicating ambiguity. The 20-line spike from hour 2 to 8 is what de-risks this; here it scales to the full demand set and gains pooling.

**Category-level matching is worthless.** "Valves" is not a match. Match at spec level or state that you cannot.

**Pooling rule.** Lines pool into one order when their specifications are compatible: equivalent units and ratings are equal (DN50 = 2 inch, PN40 = 40 bar), a subtype tightens the pooled envelope (SS316 within stainless), and a missing attribute is compatible, never a difference. The pooled order carries the tightest envelope and suppliers are matched against that.

**Demand set construction:** synthesise realistic portfolio purchase lines, but anchor every value to genuine HS-level Saudi import data from Comtrade. Purchase requests carry real PIF portfolio company names in realistic ERP formats; the "demand is simulated" disclosure is global, on every screen and said on stage, not a per-line badge. Deliberately include messy cases, Arabic free text, misspellings, mixed-language lines, inconsistent units, because handling them is the point.

**Built (2026-09-02):** the demand set is generated by `bun run demand:generate [seed] [lines]`, which takes the Comtrade import value of each sector subheading, multiplies it by `PORTFOLIO_IMPORT_SHARE` (0.12) and spreads it over purchase lines in the portfolio companies' ERP formats, Arabic and English mixed; `bun run demand:resolve` runs the Coordinator over every line and pools them.

**Local content scoring:** implement LCGPA G1 as a real, documented function from the published PDF, **input-gated**: it runs only when a supplier's real inputs (Saudi salaries, local procurement, local assets, capability building) exist, and never from class-based estimates. Until then every capability shows its LC signals: class, Made in Saudi certification, Mandatory List membership, CR activity. Label every score with which template and mechanism it uses (G1 entity-level vs G2.2 minimum-threshold vs G2.3 commercial-evaluation weight). Cite the document. *"Our scoring is LCGPA-methodology-aligned"* is the most defensible sentence in the whole pitch, do not weaken it with an invented formula.

---

## Hour 28–40, The request audit, the ladder and the gap ledger

**Auditor, request audit**, one per pooled order. Reads `portco_preferences`, returns each candidate with a fit: `fits`, `misses_lead_time`, `misses_quality`, or `conflicting_preferences` when two portcos in one order disagree, in which case the order splits rather than averaging. It reads the graph and never writes it, which is what keeps it cheap enough to run per request. **This is what makes the third reason on slide 3 a screen rather than a claim, so it comes before the ladder.**

## Hour 28–40 continued, Gap ledger and advisors

**Advisor agent**, one per gap:

```
INPUT   A manufacturing gap: a pooled order with no supported
        manufacturer or assembler capability
STEPS   1. Total pooled annual value at this HS line (Comtrade/GASTAT + pooled demand)
        2. Is it on the Mandatory List? (regulatory pressure = priority)
        3. Adjacent domestic capability, who makes something near this?
        4. Which factories could pivot with existing equipment?
        5. Raw material availability (Ta'adeen / SGS layer)
OUTPUT  An option ladder, rungs 1-6, each with state (inferred | asked |
        answered), economics, and the supplier it was put to.
        Rungs 3 and 4 produce QUESTIONS, not conclusions; the answers
        arrive through the outreach cascade. An unanswered rung is
        never rendered as a no.
```

**Adjacency inference is the differentiator.** Nobody else will attempt it. A stainless pipe-fitting plant can make valve bodies. Reason over equipment class, material handling, process similarity and existing product adjacency, not category codes.

**Raw materials layer** (Ta'adeen + Saudi Geological Survey): even shallow, it differentiates. The brief explicitly asks for raw materials and most teams will only do finished goods.

**UI, three screens, no more:**
1. **Gap ledger** (open here), ranked table opening on manufacturing gaps with a toggle to supply gaps, SAR annual value, regulatory flag, pivot candidates
2. **Capability map**, geographic, filterable by product/region/confidence
3. **Evidence drill-down**, one supplier claim, its full provenance chain, its confidence, its auditor verdict

Coverage, spend-weighted in SAR, as the persistent header figure; line coverage is secondary. It is the number PIF has never been able to state, make it impossible to miss.

---

## Hour 40–48, Rehearsal and hardening

- **The live cold-miss is a known supplier with declared capabilities only.** Pick a Tarmeez supplier the swarm never enriched, run Detective then Auditor live, and watch evidence, class and verdict appear on its node. Bounded to about two minutes. Rehearse it and pre-record it. If the stage network fails, play the recording and say so.
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
6. **Live cold-miss.** Pick an unenriched Tarmeez supplier; watch evidence, class and verdict write themselves onto its node. *(1m)*
7. **Close.** "MUSAHAMA knows who registered. KAMIN knows who never raised a hand. We are the layer underneath." *(30s)*

---

## Team split

**Who writes code:** Claude Code, in this repo, in the order above. The three own what a human must do: probes and purchases, data hunting, deck, demo and question prep.

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
6. Outreach stages 2 and 3 → design and cost them, run stage 1 for real. This is the most defensible thing to leave partly on the roadmap
7. Ladder rungs 3 to 5 → compute the economics, leave the asking to the roadmap

**Never cut:** evidence + confidence on every claim · one auditor kill on stage · the gap ledger · the coverage number · the incumbent-vs-map coverage delta, which is the number a committee acts on.
