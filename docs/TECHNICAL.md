# KAMIN — how it actually works

**Measured from the live database on 10 September 2026.** Every figure below is a
count, not an estimate. Regenerate with `bun run numbers` and `bun run cost`.

---

## 1. The claim, and what has to be true for it to hold

The story says: *the Kingdom's registries tell you a company exists and what
category it registered under; they cannot tell you whether it makes the thing
you are trying to buy, to the specification you need.* KAMIN closes that gap by
sending agents to read the open web and write down what they find, with
evidence.

For that claim to survive scrutiny, three technical things have to be true:

1. **Nothing is asserted without a source.** Every capability carries evidence
   rows, each with a URL and a tier.
2. **Every claim is traceable to the run that made it.** Not a log — a
   trajectory that is part of the product.
3. **The agents can say no.** An extraction pipeline that only ever adds is a
   scraper, not an auditor.

The rest of this document is how those three are implemented.

---

## 2. The model layer

### One model does almost all of it

| Role | Model | Runs | Avg run |
|---|---|---|---|
| Coordinator | `ollama:qwen3.5:9b` | 136 | 575 s |
| Coordinator (earlier) | `ollama:qwen3:8b` | 20 | — |
| Detective | `ollama:qwen3.5:9b` | 185 | 815 s |
| Specifier | `ollama:qwen3.5:9b` | 181 | 52 s |
| Auditor | `ollama:qwen3.5:9b` | 606 | 42 s |
| Advisor | `ollama:qwen3.5:9b` | 3 | 63 s |

**Everything on the map was produced by a 9-billion-parameter open-weights model
running locally on a 16 GB laptop.** No frontier model wrote any of it. That is
a deliberate constraint, not a limitation we are apologising for — see §7.

Embeddings: **`ollama:bge-m3`**, chosen because it handles Arabic and English in
one vector space, which matters when an HS heading is titled in both.

### Provider routing

`packages/core/src/models/registry.ts` resolves a model per role from the
environment, defaulting to local:

```ts
const DEFAULT_CHAT  = "ollama:qwen3.5:9b";
const DEFAULT_EMBED = "ollama:bge-m3";

export function modelRefFor(role: Role): string {
  return process.env[`${role.toUpperCase()}_MODEL`] ?? DEFAULT_CHAT;
}
```

A model reference is `provider:model`. Four providers are wired — **ollama,
anthropic, openai, deepseek** — so `AUDITOR_MODEL=anthropic:claude-…` moves one
role to a frontier model without touching a line of agent code. Temperature is
`0` everywhere; `numCtx` is 8192.

This is ADR 0002: *LangGraph.js with provider-agnostic models, local first.*

### Owning the structured-output parse

The single hardest engineering problem in the build, and ADR 0004 exists for it.

**Ollama's tool-call parser hands Qwen's nested arrays back as JSON strings**,
so a field declared as an array of objects arrives as `"[{...}]"` — a string
that merely looks like JSON. Schema validation then fails on output the model
got right.

The fix is `reviveJsonStrings` in `packages/core/src/models/structured.ts`:
walk every value, and parse any string that is itself JSON.

```ts
export function reviveJsonStrings(v: unknown): unknown {
  if (typeof v === "string") {
    if (!/^\s*[\[{]/.test(v)) return v;
    try { return reviveJsonStrings(JSON.parse(v)); } catch { return v; }
  }
  ...
}
```

Every agent output also has a **"Loose" Zod schema** beside its strict one — a
`z.preprocess` that accepts a bare array, a `{relations: […]}` wrapper, or a
JSON string, and canonicalises before validating. Retries are logged as run
steps (`extract_retry`), so a parse failure is visible in the trajectory rather
than silently swallowed.

**It still fails sometimes.** 5 of 29 Detective runs in one batch failed with
*"no JSON object or tool call was found in the reply"*. That is the honest cost
of a 9B model doing structured extraction.

---

## 3. Search and retrieval

Three different retrieval mechanisms, for three different problems.

### Tavily — finding pages on the open web

`packages/core/src/web/tavily.ts`. A thin client over `api.tavily.com/search`:

```ts
body: JSON.stringify({
  query, max_results: maxResults,
  search_depth: "basic",
  include_raw_content: true,
})
```

**`include_raw_content: true` is the important flag** — it returns page text
with the result, so the Detective can read without a second fetch.

**Every query is cached to disk**, keyed by `sha1(query|maxResults)` under
`data/raw/tavily/`. **507 distinct queries** are cached. Re-running a stage
costs nothing and returns byte-identical input, which is what makes the pipeline
re-runnable and the evaluations comparable.

Measured usage: **950 `tavily_search` retrieval steps** across all runs.

### Direct fetching — reading what search found

`fetch_page` (321 steps) and `fetch_document` (425 steps) pull the pages and
PDFs themselves. Cached under `data/raw/pages/` — **495 pages** — as
`{url, title, text}`.

> **Known limitation:** the fetcher stores extracted text only. The markup is
> discarded, so `og:image`, favicons and any structured data on the page are
> lost at crawl time. This is why supplier logos cannot be recovered from the
> 495 pages we have already read.

### pgvector — anchoring a purchase line to a tariff code

The Coordinator has to turn *"صمام عدم رجوع ستانلس ستيل ١ بوصة"* into HS
`848130`. Pure vector search over 10,794 HS codes was not reliable enough.

ADR 0005: **two-stage retrieval with family seeds.** `packages/core/src/hs/search.ts`

```ts
export const FAMILY_SEED_HEADINGS: Record<string, string[]> = {
  valve:   ["8481"],
  pump:    ["8413", "8414"],
  flange:  ["7307", "7412", "3917"],
  fitting: ["7307", "7412", "3917", "7609", "7507"],
};
```

The model first classifies the object family, which **guarantees** the correct
headings are on the candidate list; vector and lexical search then rank within
them. A hit records how it arrived — `seed`, `vector`, `lexical` or `both`.

- **10,672 of 10,794 HS codes carry an embedding** (98.9%)
- Embedding text combines English title, Arabic title, and parent category — so
  the vector carries hierarchy, not just the leaf label
- **125 `hs_candidates` retrieval steps** recorded

---

## 4. The five agents

Every role does one job against one input and writes a trajectory. Counts are
live.

### Coordinator (المنسّق) — the demand side
Takes one purchase line in whatever language it arrived, normalises it to a
specification, anchors it to an HS code, then pools it with matching lines
across companies and time.

Steps: `normalize` (125 llm calls) → `hs_candidates` (retrieval) → `anchor`
(126 llm calls).

**171 runs · 125 completed · 46 failed · 125 demand lines resolved · 574,981
tokens in.**

Why pooling matters: one company needing 40 valves a year is not an investment
case. Eight companies needing 40 each is a factory.

### Detective (المحقّق) — discovery
Investigates one candidate supplier: Tavily search → fetch pages → extract
capabilities with evidence. This is what finds companies no registry holds.

**185 runs · 163 completed · 22 failed · 636 evidence records · 1,093,427 tokens
in · 815 s average** — the most expensive role by far, because it does the most
I/O.

It also decides `is_same_company`. **67 of 160 recorded runs concluded the pages
found described a *different* company** — a real negative finding, and the
reason "investigated" is a weaker signal than it looks.

### Specifier (المُحدِّد) — the second pass
Reads the supplier's catalogues and datasheets, following catalogue and PDF
links **one level below the product pages**, and writes the specifications those
documents actually state: sizes, pressure ratings, materials, end connections,
standards. Also writes the typed relations.

**181 runs · 172 completed · 198 evidence records · 73 relations · 52 s average.**

This is the only agent that moves a pooled order from *"declared at category
level"* to *"verified at the stated specification"* — the 98.9% → 2.1% gap.

### Auditor (المدقّق) — the adversary
Takes one capability and **tries to refute it**, then assigns its class. Runs
four lenses: is it real, is it at spec, what class, and local content.

**606 runs · 570 completed · 469 capabilities judged · 623 `audit` llm calls.**

Of capabilities judged in the slice: **326 supported, 31 refuted.** A pipeline
that never refutes is a scraper; this one refutes about 9%.

Design details that matter: a lens the model omits **fails validation and is
retried, never defaulted** — an absent judgement must never become a silent
pass. And *being a trader is never grounds for refutation* — that is a class,
not a failure.

### Advisor (المستشار) — the output
Turns one gap into an investment case: what is missing, what it is worth
annually, what it would take to make locally, and who could pivot into it.

**3 runs · 2 investment cases · 4,027 tokens in.** The thinnest role, because
the gap ledger currently holds only 2 supply gaps.

---

## 5. Data layer

**ADR 0001: one Postgres for graph, vectors, queue and checkpoints.** No Neo4j,
no Pinecone, no Redis. `pgvector 0.8.6` on Postgres 17.

The justification is operational, not ideological: a hackathon build that has to
survive a demo cannot afford four datastores with four failure modes. A graph
is `subject → predicate → object` rows with two indexes; that traverses fine.

Core tables: `suppliers` · `capabilities` · `evidence` · `relations` ·
`products` · `hs_codes` · `demand_lines` · `pooled_orders` · `matches` ·
`gap_cases` · `imports` · `mandatory_list` · `runs` · `run_steps`.

### Evidence tiers — where a page lives decides its tier

| Tier | Meaning | Counts toward coverage |
|---|---|---|
| 1 | Third-party verified — certifier, award, standards body | ✅ |
| 2 | Official registry — Tarmeez, commercial register, MLCP | ✅ |
| 3 | Self-published — the supplier's own site and catalogues | ❌ |
| 4 | Inferred — adjacency and equipment signals | ❌ |

The subtlety: an ISO certificate **on the supplier's own website is Tier 3**;
the same certificate on the certifier's page is **Tier 1**.

### The relations graph
Seven predicates, 73 edges: `distributes_brand`, `part_of_group`,
`certified_by`, `meets_standard`, `same_entity_as`, `makes_with_material`,
`uses_process`. Every edge carries an excerpt; 68 of 70 carry a source URL.

> **Known defect:** `object_id` is null on every edge. The name matcher keys on
> the object's first word, and in a country where thousands of companies begin
> with "Saudi" or "Al", it never resolves. The graph is currently a star of
> supplier → free-text, not a traversable network.

### Trajectories are product data — ADR 0003
`runs` (id, role, input_ref, model, status, error, timings) and `run_steps`
(seq, kind, name, input, output, duration_ms, tokens_in, tokens_out) are
**product tables, not observability**. Langfuse is dev-only. Every claim in the
UI links to the run that produced it, and the `/agents` and `/runs/[id]` screens
render those tables directly.

Step kinds recorded: `retrieval`, `llm_call`, `tool_call`, `note`, `error`.

---

## 6. Data sources

| Source | What it gives | Volume |
|---|---|---|
| **Tarmeez** (`psnr.mim.gov.sa/CatalogApi`) | Registered industrial plants, declared products by tariff code | 14,873 plants, 4,836 distinct codes |
| **MLCP** (Madinah chamber) | Chamber directory factories | 435 |
| **Made in Saudi** (`saudimade.sa`) | Certified companies, descriptions, **company logos** | 281 (279 cached, 259 with images) |
| **UN Comtrade** | Saudi import values by HS code, 2024 | HS 8481 $2.92bn · 8413 $1.31bn · 7307 $749m |
| **LCGPA Mandatory List** | Products state entities must source locally | 2027 tranche |
| **The hunt** | Long-tail discovery via Tavily, in no registry | 10 suppliers |

> **Tarmeez publishes the schema and withholds the values for contact details.**
> `Email`, `PhoneNo`, `MobileNo` and `WebSiteUrl` are keys on every record and
> `null` on **all 14,872** cached plant files (0.00%). Verified against the live
> API, not just the cache. We hold `cr_number` for 15,015 of 15,025 suppliers,
> which is the only realistic join key for acquiring contacts later.

---

## 7. Why local, and what it costs

**The whole system runs on one 16 GB Apple Silicon laptop**: Postgres in
OrbStack, Ollama serving `qwen3.5:9b` over Tailscale, Next.js, and a Cloudflare
tunnel — concurrently.

The argument is not that a 9B model is better. It is that **supplier data for a
sovereign wealth fund's portfolio is exactly the data you do not want to send to
a third-party API**, and the architecture proves the pipeline works without
doing so. Because model routing is per-role and provider-agnostic, any role can
be moved to a frontier model with an environment variable when latency or
accuracy matters more than locality.

**Total measured cost so far: 1,146 runs · 2,926,943 tokens in · 496,120 out ·
zero riyals**, because nothing left the machine except Tavily searches.

What it costs in quality:

- **Structured-output failures.** ~17% of Detective runs in the last batch.
- **Latency.** 815 s per Detective run. One Ollama instance serialises every
  call, so `--concurrency 2` contends rather than parallelises.
- **Memory pressure.** With Ollama holding ~4 GB, the machine ran to ~63 MB
  free, and 2 runs died with `llama-server process no longer running`.
- **Terminal errors.** The swarm selects `detective_status = 'pending'`, and a
  failed run writes `'error'`. Nothing resets it, so **19 suppliers are
  permanently excluded** from future passes after transient OOM failures.

---

## 8. Where the numbers land

| | |
|---|---|
| Suppliers on the map | 15,025 |
| … investigated by a Detective | 146 |
| … absent from Tarmeez, found by us | 152 |
| Capabilities claimed | 51,992 |
| … audited | 469 |
| … supported / refuted (slice) | 326 / 31 |
| Evidence records | ~53,800 |
| Typed relations | 73 |
| Pooled orders | 72, worth $357.9m/yr |
| **Coverage at stated specification** | **2.1%** |
| … type-verified | 70.5% |
| … category level | 98.9% |

**The ladder is the finding.** A registry-style lookup says the Kingdom covers
98.9% of this spend. Checking the size, rating, material and standard actually
demanded says 2.1%. That collapse is the information a procurement officer
cannot get today, and producing it is the entire point.

### The result that killed a theory

On 9 September the Detective pass was widened from 80 to 146 suppliers, the
Auditor ran over every new capability, and matching and coverage were recomputed.

**Supported capabilities in the slice grew from 199 to 326 — a 64% increase.
Coverage moved 0.0 points.** All three rungs held exactly still.

That rules out the obvious hypothesis. Coverage is **not** limited by how many
companies have been investigated. It is limited by **how much specification
detail is held per company** — and none of the 66 newly investigated suppliers
states a size, pressure class and material matching what a pooled order demands.

The next move is therefore not "crawl more companies". It is acquiring real
specifications from somewhere other than the open web.

---

## 9. Stack

**Runtime** Bun · TypeScript · Next.js 16 (App Router, RSC) · Tailwind v4
**Agents** LangGraph.js · LangChain community model adapters
**Models** Ollama `qwen3.5:9b` (chat), `bge-m3` (embeddings); Anthropic, OpenAI,
DeepSeek adapters wired but unused
**Search** Tavily (`search_depth: basic`, raw content on), disk-cached
**Data** Postgres 17 + pgvector 0.8.6, in OrbStack
**Serving** `next start` under launchd → Caddy → Cloudflare Tunnel →
`kamin.shalabi.dev`, basic-auth gated, `noindex`

### Architecture decisions
- **ADR 0001** — one Postgres for graph, vectors, queue and checkpoints
- **ADR 0002** — LangGraph.js with provider-agnostic models, local first
- **ADR 0003** — trajectories are product data; Langfuse is dev-only
- **ADR 0004** — own the structured-output parse
- **ADR 0005** — two-stage HS retrieval with family seeds

---

## 10. Honest limitations

1. **The verified layer is ~0.9% of the map.** 469 of 51,992 capabilities have
   been audited. Everything above is measured on a thin slice.
2. **Discovery has not yet changed an answer.** 152 suppliers found outside
   Tarmeez, 7 with supported capabilities — but **zero** pooled orders have a
   newly-discovered supplier as best match.
3. **`detective_status = 'ok'` overstates.** It means the run did not throw. 67
   of 160 runs concluded "wrong company"; 64% wrote no capabilities.
4. **Relations do not traverse.** `object_id` null on all edges.
5. **No contact channel.** Zero phones, zero emails for 15,025 suppliers.
6. **No scheduled operation.** Agents run when someone runs them. The only live
   agent path is the cold miss — an unseen supplier triggers a Detective run in
   the browser, streamed over SSE, written back to the graph.
7. **Demand is simulated.** Real Comtrade 2024 import values at an assumed 12%
   portfolio share. Supply is real; demand is a model.
