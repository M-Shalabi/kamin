<img src="assets/kamin-logo.png" alt="KAMIN" width="120" align="right">

# KAMIN · كامن

**الموجود الغير مكتشف**, what exists but has never been found.

A live map of Saudi industrial capability, built by autonomous agents that read
the open web and write down what they find, with evidence attached to every
claim.

Built for the PIF Innovate Hackathon, Track One.

---

## The problem

Ask a buyer at a portfolio company "is there a local supplier for this?" and
nobody can answer it. ChatGPT has no Saudi data. Saudi Made is a mark on a
product, not a supplier directory. The approved supplier list holds only who you
have bought from before.

So portfolio companies buy from foreign suppliers for three reasons, and only
one of them is a good one:

1. Genuinely nobody makes it here.
2. Someone makes it, but it does not fit: quality, lead time, or a different
   standard.
3. Someone makes it two hours away, and nobody knows they exist.

Reasons two and three need opposite responses, and today nothing can tell them
apart. The registries prove a company exists and what category it registered
under. They cannot tell you whether it makes the thing you are trying to buy, to
the specification you need.

Doing this by hand does not scale: 12,946 plants at one working day each is 35
years, and the day you finish, what you know is out of date.

## What KAMIN does

Two limbs meet at one map.

**Discovery.** Agents read public registries and the open web, find suppliers,
extract what each one can actually make, and audit those claims against
evidence.

**Demand.** Agents take purchase lines out of portfolio company systems in
whatever language and shape they arrived in, normalise each to a specification,
anchor it to a tariff code, and pool it across companies.

Where the two meet, the map answers the question. Where it cannot, the gap is
booked at its annual value and walked up a ladder of instruments (buy, split
award, invest in capacity, partner, localise, import), and what survives becomes
a coverage rate.

## The agents

Five roles. Each does one job against one input, and each writes a trajectory
that is part of the product, not a log.

| Agent | | Does | Writes |
|---|---|---|---|
| **Coordinator** | المنسّق | Normalises one purchase line, anchors it to an HS code, pools it | A resolved demand line |
| **Detective** | المحقّق | Searches, fetches pages, extracts capabilities from the open web | A supplier with its evidence |
| **Specifier** | المُحدِّد | Follows catalogues and datasheets one level down, reads the stated specs | Specifications and typed relations |
| **Auditor** | المدقّق | Tries to **refute** each capability, then assigns its class | A verdict and a class, per claim |
| **Advisor** | المستشار | Turns one gap into an investment case | A gap entry and a coverage rate |

Three properties hold the whole thing up:

- **Nothing is asserted without a source.** Every capability carries evidence
  rows, each with a URL and a tier: third-party verified, official registry, or
  self-published.
- **Every claim traces to the run that made it.** Trajectories are product data.
- **The agents can say no.** A pipeline that only ever adds is a scraper. The
  Auditor refutes about 9% of what it judges, and a lens the model omits fails
  validation and is retried, never defaulted to a pass.

The Detective also decides `is_same_company`, and **67 of 160 recorded runs
concluded the pages it found described a different company**. That is a real
negative finding, and the reason "investigated" is a weaker signal than it looks.

## Where it stands

Measured from the live database on 10 September 2026. Regenerate with
`bun run numbers` and `bun run cost`, and see [`COUNTS.md`](COUNTS.md).

| | |
|---|---|
| Suppliers on the map | **15,025** |
| … from Tarmeez · Madinah chamber · Made in Saudi · no register at all | 14,873 · 114 · 28 · 10 |
| Capabilities (one supplier, one product, to a stated spec) | **51,992** |
| … audited | 467 (0.9%) |
| Agent runs · tokens in | **1,146** · 2.93M |
| Model spend | **zero** |

Zero because `qwen3.5:9b` runs locally on Ollama and Tavily is on its free tier
with its results cached to disk. The same token spend priced elsewhere is
roughly $2 on Gemini Flash, $12 on GPT-4o, $81 on Claude Opus.

**Everything on the map was produced by a 9-billion-parameter open-weights model
on a 16 GB laptop.** No frontier model wrote any of it. That is a deliberate
constraint: re-running the entire pipeline has to be a free decision rather than
a budget one.

[`TECHNICAL.md`](TECHNICAL.md) closes with the honest limitations, and they are
worth reading before the numbers above are quoted anywhere.

## Stack

**Runtime** Bun · TypeScript · Next.js 16 (App Router, RSC) · Tailwind v4
**Agents** LangGraph.js · LangChain community model adapters
**Models** Ollama `qwen3.5:9b` (chat), `bge-m3` (embeddings); Anthropic, OpenAI
and DeepSeek adapters wired behind the same interface
**Search** Tavily, disk-cached
**Data** Postgres 17 + pgvector, one database for the graph, the vectors, the
queue and the checkpoints

A model reference is `provider:model`, resolved per role from the environment,
so `AUDITOR_MODEL=anthropic:claude-…` moves one role to a frontier model without
touching a line of agent code.

## Running it

```bash
cp .env.example .env      # TAVILY_API_KEY is the only key the default path needs
bun install
bun run db:up             # Postgres 17 + pgvector, via docker compose
bun run migrate
bun run web:dev           # or: bun run demo, which does db:up and web:dev
```

The agents are not scheduled. They run when you run them:

```bash
bun run coordinator       # demand lines in
bun run detective         # discovery over the queue
bun run spec:pass         # catalogues and datasheets
bun run auditor           # judge the capabilities
bun run match             # demand against capability
bun run coverage          # what we could serve locally
bun run advisor           # what is left, as investment cases
bun run numbers           # regenerate COUNTS.md
```

Checks: `bun run typecheck`, `bun run typecheck:web`, `bun test`.

## Repository

| | |
|---|---|
| `packages/core/src` | The agents, the data layer, the sources, the matching |
| `packages/core/scripts` | One entry point per run above |
| `apps/web` | The product surface: orders, gaps, suppliers, coverage, the graph |
| `deck/` | The pitch deck generator. `gen2.py` is the source of truth; `gen_en.py` derives the English deck from the Arabic one |
| `docs/adr` | The five architecture decisions, and why |

## Documents

| | |
|---|---|
| [`TECHNICAL.md`](TECHNICAL.md) | How it actually works, and what it cannot do |
| [`COUNTS.md`](COUNTS.md) | Every count, token and hour, straight from the database |
| [`CONTEXT.md`](CONTEXT.md) | The vocabulary. Read this before the rest |
| [`STORY.md`](STORY.md) · [`STORY_AR.md`](STORY_AR.md) | The narrative |
| [`SUBMISSION.md`](SUBMISSION.md) · [`SUBMISSION_AR.md`](SUBMISSION_AR.md) | The formal submission |
| [`PITCH.md`](PITCH.md) · [`PITCH_AR.md`](PITCH_AR.md) | The deck, slide by slide |
| [`DATA_SOURCES.md`](DATA_SOURCES.md) | Every source, its endpoint and its terms |

## A note on what KAMIN is not

It is not a replacement for MUSAHAMA. MUSAHAMA knows who registered. KAMIN knows
who never raised a hand. There is no login here, no upload, no approval queue: a
supplier never fills anything in, and the only destination the outreach carries
is MUSAHAMA's own registration.

---

**The team** · Mohammed Shalabi, AI-Native Principal Engineer · Ali Bamuallim,
Product Consultant · Abdulaziz Al Harthi, Data Engineer and DevOps
