# FACTS, open items to tackle later

Running log of corrections, unverified claims, and decisions still owed.
Newest concerns at the top of each section. Nothing here is fixed in the deliverables
unless the status says so.

---

## 1. Supplier ≠ factory  ✅ resolved, shipped everywhere

> **"Btw suppliers are not necessarily factories, it's at least still a local supplier."**

**Why it mattered.** The original design conflated *supplier* with *manufacturer*.
That is wrong in both directions:

- A local supplier can be a distributor, an assembler, a fabricator, a workshop, a service
  provider, or a systems integrator. None of them appear in a factory count.
- Even a trading company that imports and resells **is still a local supplier**. It employs
  Saudis, holds local assets, pays local margin. Its local content is *lower*, not *zero*.

**What it broke, and what it became:**

| Where | Was | Is now |
|---|---|---|
| المدقّق role (deck slide 12, script) | "manufacturer or reseller?" treated as pass/fail, "ثنتين من الأربع ما ينجون" | A **classification with a local-content score**, not a kill. Reseller is a valid tier, scored lower |
| Population math (12,946) | Presented as *the* supplier universe | It is the **manufacturing subset only**. The supplier universe is larger (commercial registrations, service providers) |
| Gap ledger | "nobody makes it" | "nobody can supply the pooled order". The finer split (**nobody manufactures it** vs **nobody supplies it locally**) is still owed, see below |
| Value story | Find the factory | Finding a local distributor still beats importing direct in some categories |

**Alignment note:** LCGPA's own methodology already treats this as a spectrum, scoring Saudi
salaries, local assets, and local procurement, not a binary "is it a factory". So moving to a
tiered supplier model makes the scoring *more* methodology-aligned, not less.

**Action taken.** The Auditor now **classifies instead of eliminating**: manufacturer, assembler,
authorised distributor, or trader, each carrying its own local-content weight. This is live in the
deck (AR slide 12 and EN slide 12), `SUBMISSION.md`, `SUBMISSION_AR.md`, `ANSWERS.md`, both story
files, both pitch files, and `BUILD_PLAN.md`.

**Resolved 2026-09-02:** two named gaps. *Manufacturing gap* = no supported manufacturer or
assembler capability, the ledger's default view and the investment case. *Supply gap* = no supported
capability of any class. Definitions in `CONTEXT.md`, mechanics in `BUILD_PLAN.md`.

---

## 2. Numbers that need a citable source before going on stage

- **Coordinator spike, measured 2026-09-02:** `qwen3.5:9b` resolved 20/20 HS anchors
  (attribute score 0.986); pooling produced 15 orders from 20 lines, with the three-line ball
  valve scenario, the two gate valves, the two centrifugal pumps and the two elbows each pooled. About
  53 seconds per line on a 16 GB laptop. Evidence in `docs/eval/2026-09-02-coordinator-spike-qwen3.5-9b.md`.
  The `qwen3:8b` A/B did not run (model removed from the machine); pull it and re-run before quoting a comparison.
- **Detective and Auditor swarm, measured 2026-09-02:** 86 suppliers investigated (60 in the swarm at 93 min,
  the rest from tests, the stage recordings and the hunt), 323 slice capabilities audited: 206 supported,
  13 refuted, 104 pending. 17 suppliers discovered by the long-tail hunt in no registry, 13 of them with a
  supported capability. Per successful run on `qwen3.5:9b`: Detective 98 s, Auditor 22 s (17 s once the
  audit went to JSON text), Coordinator 66 s (47 s in the milestone-1 spike; the difference is `bge-m3`
  and `qwen3.5:9b` swapping in one Ollama slot), Advisor 63 s; at Claude Opus 5 prices a Detective run
  would cost about $0.05 and an audit about $0.01, so the "$0.30 per factory" estimate is high by
  roughly five times. Evidence in
  `docs/eval/2026-09-02-coverage-and-gaps.md` and `docs/numbers.md`.
- **Hunt hygiene, 2026-09-02:** seven of the seventeen suppliers the long-tail hunt created were Indian or
  Chinese exporters with Saudi landing pages, or a duplicate; removed from the map and the hunt now
  requires a plant, office, warehouse or stock inside the Kingdom. Discovery lift figures before this
  note counted them.
- **Coverage, measured 2026-09-02:** 96 simulated lines pooled into 72 orders worth USD 357.9M a year.
  **At the stated specification: 2.1%, five stainless flange orders verified against a catalogue**
  (2026-09-03, after the Specifier's deep pass and two matching fixes). Product type verified (the
  supplier names the order's product type, nothing in conflict): 70.5% of spend, 49 of 72 orders. At
  category level (a verified plant declares the subheading): 98.9% of spend, 70 of 72 orders. The graph
  also holds 70 typed relations across 17 suppliers (brands distributed, groups, certifiers, standards). Two supply gaps (carbon-steel butt-weld tees, USD 4.1M a year) with
  Advisor cases, no manufacturing gaps. Say both figures on stage; the distance between them is the
  blind spot. This framing was decided without Mohammed and needs his confirmation.
- **⚠️ 2026-09-02, the Tarmeez re-count breaks the headline.** The catalogue API reports **14,873
  plants** and **59,611 products** (`DATA_SOURCES.md`, re-test table). 14,873 is larger than the
  12,946 "operating factories" figure, so "3,153 of 12,946, 76% absent" cannot be said until both
  populations are defined. Two ways out: (a) pin 12,946 to its source and explain that the catalogue
  also holds traders and non-operating plants, then recount; (b) re-base the blind spot on capability
  depth (self-declared tariff lines with a tonnage, no specification, no web presence in a 25-plant
  sample) rather than on registry presence. Deck slides 6, 7 and 14, STORY, SUBMISSION and ANSWERS all
  carry the old numbers.
- **Mandatory List, a fourth figure:** 965 products / 14 sectors (2026 expansion, SPA and local
  press). Four metrics to reconcile now, not three.
- **12,946 factories (end of 2025)**, user-supplied, plausible, **source not pinned**.
  Likely Ministry of Industry / NIIC or GASTAT. Note the two counts measure different things:
  12,946 = licensed/operating factories; 3,153 = factories with *registered products* in Tarmeez.
  That difference is the whole argument, so state it explicitly before a MoI judge asks.
- **$0.30 per factory of AI compute**, my estimate, never measured. Run 10 real factories
  end to end and quote the measured cost. A measured number is unattackable; an estimate
  invites the wrong argument.
  Note (2026-09-02): the build runs on local Ollama models first, so measure twice: once on
  the local path (electricity, effectively zero marginal cost) and once on a paid API, and say
  which one the $0.30 refers to. Measured the same evening: about $0.06 per supplier for one
  Detective run plus one audit at Opus 5 prices (`bun run cost`).
- Tarmeez product count: **52,824 (AR view) vs 12,641 (EN view)**, superseded 2026-09-02 by the
  API: 59,611 product registrations collapsing to 4,834 distinct tariff codes. Say "59,611 registered
  product lines" or "4,834 distinct products", never the old numbers.
- Mandatory List size: **1,444 vs 233 vs 116** are three different metrics, not three estimates.

---

## 3. Unverified process claims

- The as-is procurement flow (requisition → buyer → approved vendor list → decision) is
  **standard industrial practice**, high confidence. But the PIF-portfolio specifics
  AVL size, who approves it, what share of spend runs through it, are **inference, unverified**.
  One conversation with a real buyer in any portfolio company converts the strongest slide
  from persuasive logic into documented fact.

---

## 4. Decisions made but not yet written into the docs

- **RFQ scope.** Decided: the product stops at a **prepared package handed to the buyer**,
  who sends it from their own system. KAMIN never sends an RFQ. A capability-confirmation
  ping ("we think you can make this, correct?") is the feedback loop; supplier-side pull
  is roadmap. Not yet stated in SUBMISSION or on any slide, and it is the answer to
  "طيب وبعدين؟" which a judge will ask.

---

## 5. Blocked / external

- **Notion pages are stale, and this is now the largest gap.** Three reshapes behind as of 2026-09-09. All three still carry the name
  **نسيج**, the pre-reshape mechanism (factory-by-factory discovery, no demand pooling), the old
  role names, 17 slides, and no English version at all. The local `.md` files, the PDFs and the
  published canvas are current; Notion is roughly three reshapes behind.
- **Figma file is stale and quota-blocked.** Starter plan + View seat = 20 tool calls/month, spent.
  The four role character images are uploaded but sit as loose frames on the canvas. It also predates
  the KAMIN rename, the interstitial, the team slide and the English deck, so it is a rebuild rather
  than a touch-up. Resets monthly, or upgrade to a Full/Dev seat for 200/day.
- **`figma-work` MCP server is a duplicate.** `whoami` shows the original `figma` connection is
  already sh414bi@gmail.com. Either authenticate `figma-work` to a genuinely different account
  (use a private window) or remove it.
- **`codegraph` MCP server fails to start**, executable not found in `$PATH`. Unrelated to this
  project, but it errors on every session start.

---

## 6. Style rules now in force

- **No em dashes anywhere.** 335 removed across all files. Use a comma, a colon, a middle dot,
  or restructure the sentence. This applies to anything generated from here on.
- Deck copy is in the user's **Saudi dialect**; SUBMISSION files remain MSA.
- Arabic-Indic numerals with a comma (`٣,١٥٣`) and the `·` separator both break the bidi
  engine and emit a phantom `٠`. Use bare digits (`٣١٥٣`) in Arabic runs.
- RTL flex: the **first DOM child renders rightmost**. Do not reverse the array in HTML the
  way you must in Figma auto-layout, which is always LTR. The corollary: an LTR derivation of an
  RTL slide needs **no** reordering, only `dir` flipped, because DOM order is reading order in both.
- **Thmanyah has no usable Latin**, and the embedded subset is Arabic-only. The English deck sets
  in **Archivo** (Google Fonts, allowed by the artifact CSP) at the same weights. IBM Plex Mono
  has no Arabic glyphs at all, so it is used only for numerals and Latin labels.
- Arabic line-heights are loose for its ascenders. Latin display type derived from them must be
  tightened (1.06 at 46px and above) or the slide overflows its footer.
- Latin copy runs longer than the Arabic it came from. Two headlines needed a smaller size or a
  shorter phrasing to hold one line: slide 7 and slide 19.

---

## 7. Current state of the deliverables

- **Deck: 20 slides plus an unnumbered appendix, in both Arabic and English**, 42 artboards on one
  canvas. Slide 8 is the inverted-colour interstitial, slide 17 the outreach cascade, slide 20 the team.
- **The English deck is derived, not hand-written.** `deck/gen_en.py` reads each Arabic artboard and
  applies a 287-entry translation map from `deck/tr_en.py`, flips `dir`, swaps the font stack,
  converts Arabic-Indic numerals, flips the flow arrows and mirrors the map diagram. So a change to
  `deck/gen2.py` propagates to both languages, and any new Arabic string fails loudly until it is
  translated. Do not hand-edit `EN_*.dc.html`. `deck/render.py` builds the three PDFs, and
  `python3 deck/render.py --only Blind,TheMap` spot-checks single slides while iterating.
- **PDFs:** `KAMIN-Pitch-Deck.pdf` (40 pages, AR then EN), `-AR.pdf` and `-EN.pdf` (20 each), fonts
  embedded so exports keep their typography.
- **Canonical name:** كامن / KAMIN, "the thing that exists but has never been found".
  Slogan: **موجود. بس ما أحد شافه.**
- **Team of three:** Mohammed Shalabi (Owner, AI-Native Principle Engineer), Ali Bamuallim
  (Product Consultant), Abdulaziz Al Harthi (Data Engineer / DevOps). `BUILD_PLAN.md` is written
  against these three by name.
- **Open question for the user:** the title reads "AI-Native **Principle** Engineer" as supplied.
  If *Principal* was meant, it changes in the deck, both PDFs, both pitch files and the canvas.

---

## 8. Engineering decisions, 2026-09-02 (grilling session)

Every decision below is written into `CONTEXT.md` (names), `docs/adr/` (reasoning) and
`BUILD_PLAN.md` (mechanics). Listed here so nothing is re-litigated by accident.

- **Timing:** window is weeks away, pre-build allowed. Hour numbers are a build order, not a clock.
  Claude Code writes the code; the three own probes, purchases, data hunting, product and pitch.
- **Stack:** TypeScript end to end. LangGraph.js. Per-role model registry, Ollama first
  (`qwen3.5:9b`), switchable to Claude, OpenAI or DeepSeek. `bge-m3` embeddings. Postgres + pgvector
  in Docker (OrbStack) holding graph, vectors, pg-boss queue and checkpoints. Trajectories in
  Postgres plus a terminal stream; Langfuse self-hosted as dev viewer. Tavily search. Next.js UI.
- **Entity model:** `Supplier` replaces `Factory`. Class (manufacturer / assembler / authorised
  distributor / trader) lives on each capability, not on the supplier.
- **Auditor rule (refined 2026-09-02 after the first live audits):** only a refuted is-it-real lens
  kills a capability, and that kill is demo step 5. A refuted is-it-at-spec lens on a real product
  strips the unsubstantiated attributes and keeps it supported at category level with discounted
  confidence; a claim that states no attributes has no spec lens to fail. Is-it-local outputs a class.
  `bun run reverdict` recomputes stored verdicts from saved lenses when this rule changes.
- **Evidence:** tiers 1 to 4 from `SUBMISSION.md` are canonical. BUILD_PLAN's
  primary/secondary/marketing and STORY's strongest-to-weakest are retired as names.
- **Threshold:** a capability counts toward coverage only when supported and backed by Tier 1 or 2,
  at the order's own subheading and with no stated attribute in conflict (refined 2026-09-02 after the
  first matching run let a pressure-reducing valve line "cover" a ball-valve order at heading level).
- **Coverage:** spend-weighted share of pooled annual demand value, portfolio level, **at the stated
  specification** (refined 2026-09-02: with attribute-less registry declarations counting, coverage read
  98.9% while not one order was verified at spec). Category-level coverage and line coverage are secondary.
- **Gap kinds:** manufacturing gap (ledger default) and supply gap (toggle).
- **LC scoring:** G1 implemented and input-gated; LC signals shown per capability meanwhile.
- **Sector:** valves, pumps and pipe fittings (HS 8481, 8413, 7307).
- **Pooling rule:** equivalent units and ratings pool; subtypes tighten the envelope; a missing
  attribute is compatible.
- **Demand names:** real PIF portfolio company names, with a global "demand is simulated"
  disclosure rather than a per-line badge. Chosen for vividness over my recommendation of personas.
- **Cold miss on stage:** a Tarmeez supplier with declared capabilities only, enriched live.

**Deck drift to fix at the next regeneration** (`deck/gen2.py` + `deck/tr_en.py`): slides 15 and
16 say "Gap register" in English, canonical is "Gap ledger"; `deck/Strategist.dc.html` and its EN
twin are the Advisor slide under its old name. `SUBMISSION.md` §5 said "Scout" and "Resolver";
fixed to Detective and Coordinator on 2026-09-02.

**Machine note:** the data volume was at 96% on 2026-09-02. Langfuse is deferred until space is
freed; Postgres runs first.

---

## 8. The reshape of 2026-09-09, and what it left open

The design changed on five axes at once. `docs/superpowers/specs/2026-09-09-incumbent-baseline-and-outreach-design.md` is the spec; `CONTEXT.md` carries the vocabulary. What is worth flagging here:

**Resolved by the user, and it changes the numbers.** MUSAHAMA and portfolio company data **are** available. Layer 0 is real, so incumbent coverage and discovery lift are measured rather than simulated. The asymmetry that remains, and that must be said on stage: **the incumbent baseline is real, the demand lines are still simulated** against real HS import values.

**Numbers now on a slide that are not yet measured.**
- **Outreach per-contact costs**, `~$0.0001` email, `~$0.04` WhatsApp, `<$1.00` voice, on slide 17. These are order-of-magnitude, not quotes. Price the WhatsApp Business API for Saudi Arabia and the voice stack from real vendors before saying them out loud.
- **Response rates for all three cascade stages are unmeasured, and are deliberately absent from the slide.** The bar widths on slide 17 are a visual metaphor with no percentage attached, which is intentional: the cost argument is structural, so it survives a pessimistic funnel and needs no optimistic rate. Do not add percentages later.
- **Reachability is measurable today and has not been measured.** `suppliers` already holds `email`, `phone` and `website` from Tarmeez, so the share of candidates with a usable contact is computable from the graph as it stands. Run it: it bounds the funnel with a real number, and it is a better thing to show than a guessed rate.
- The `$0.30` per factory estimate from before is unchanged and still unmeasured.

**A correction to the funnel's own assumption, worth keeping in mind.** The expectation that most suppliers answer the email rests on the large ones with sales teams replying. But by construction those are already in layer 0 or 1: they registered, that is how they got there. **The cascade runs mostly on layer 2**, the segment least reachable by business email and most reachable by WhatsApp. Hence entry-point routing: a supplier with no email on record enters at stage 2 rather than burning a five-day wait.

**Still owed in the design, not just the build.**
- The gap ledger still does not split *no local manufacturing* from *no local supply at all*. Carried over from item 1 and still open.
- The RFQ boundary is decided and appears on no slide and in no submission. Still open.
- `volume_status` is specified and not yet built. Until it is, a pooled order that a supplier can make but cannot make *enough of* is still counted as covered, which overstates the baseline.
- Rungs 3 to 5 of the option ladder make the Advisor multi-turn and stateful where she is one-shot today. That is the largest single build in the spec.

**Compliance surfaces to name before they surprise anyone.** The WhatsApp Business API requires pre-approved message templates and has opt-in rules, and outbound voice at scale has its own regulatory surface in the Kingdom. Both are ordinary B2B procurement outreach; both have a shape worth checking in week one rather than week three.

**"AI-Native Principle Engineer"** on slide 20 is as supplied. If *Principal* was meant, it changes in the deck, three PDFs, both pitch files and the canvas.
