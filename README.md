<img src="assets/kamin-logo.png" alt="KAMIN" width="120" align="right">

# KAMIN · كامن

**الموجود الغير مكتشف**, what exists but has never been found.

A live map of Saudi industrial capability, built by autonomous agents that read
the open web and write down what they find, with evidence attached to every
claim. Built for the PIF Innovate Hackathon, Track One.

This README is the runbook. It takes you from a clean machine to the full
pipeline, the web app and the deck, and says at each step what you should see.
For the story, the numbers and the limitations, the documents are listed at the
end.

---

## 1. What you are about to run

Ask a buyer at a portfolio company "is there a local supplier for this?" and
nobody can answer it. The registries prove a company exists and what category it
registered under. They cannot say whether it makes the thing you need, to the
specification you need. Doing it by hand does not scale: 12,946 plants at one
working day each is 35 years.

KAMIN is two limbs meeting at one map.

- **Discovery.** Agents read public registries and the open web, find suppliers,
  extract what each can actually make, and audit those claims against evidence.
- **Demand.** Agents take purchase lines out of portfolio company systems,
  normalise each to a specification, anchor it to a tariff code, and pool it
  across companies.

Where the two meet, the map answers the question. Where it cannot, the gap is
booked at its annual value and handed to an Advisor, and what survives becomes a
coverage rate.

### The five agents

| Agent | | Does | Writes |
|---|---|---|---|
| **Coordinator** | المنسّق | Normalises one purchase line, anchors it to an HS code, pools it | A resolved demand line |
| **Detective** | المحقّق | Searches, fetches pages, extracts capabilities from the open web | A supplier with its evidence |
| **Specifier** | المُحدِّد | Follows catalogues and datasheets one level down, reads the stated specs | Specifications and typed relations |
| **Auditor** | المدقّق | Tries to **refute** each capability, then assigns its class | A verdict and a class, per claim |
| **Advisor** | المستشار | Turns one gap into an investment case | A gap entry and a coverage rate |

Three properties hold it up. Nothing is asserted without a source. Every claim
traces to the run that made it, because trajectories are product data, not logs.
And the agents can say no: the Auditor refutes about 9% of what it judges, and
the Detective concluded in 67 of 160 recorded runs that the pages it found
described a different company.

### What to expect

Everything below was produced by a 9-billion-parameter open-weights model on a
16 GB laptop, with model spend of zero. Measured 10 September 2026, details in
[`docs/COUNTS.md`](docs/COUNTS.md).

| | |
|---|---|
| Suppliers on the map | 15,025 |
| Capabilities (one supplier, one product, to a stated spec) | 51,992 |
| Capabilities audited | 467 |
| Agent runs · tokens in | 1,146 · 2.93M |

Expect the local model to be slow. One Coordinator line is about a minute. One
Detective plus Auditor pass over one supplier is four to six minutes. The
ingests are network bound and take tens of minutes for the full registries. None
of it needs to finish before the web app is useful: every screen reads from
Postgres and shows whatever is there.

[`docs/TECHNICAL.md`](docs/TECHNICAL.md) closes with the honest limitations.
Read them before quoting any number above.

---

## 2. Prerequisites

| Need | Why | Notes |
|---|---|---|
| **Bun 1.3+** | Runtime, package manager, test runner | Everything runs with `bun run` from the repository root |
| **Docker** | Postgres 17 with pgvector | OrbStack on macOS works: `orbctl start` |
| **Ollama** | Chat and embedding models | Pull `qwen3.5:9b` and `bge-m3`. About 6 GB and 1.2 GB. 16 GB RAM is enough |
| **Tavily API key** | Web search for the Detective, the Specifier and long-tail discovery | Free tier is enough. See section 3 for exactly which commands need it |
| Python 3.11, Google Chrome | Only to regenerate the pitch deck | `pip install python-pptx lxml` |
| Playwright Chromium | Only for `bun run capture:mis` | `bunx playwright install chromium` |

Ollama can run on another machine. Point `OLLAMA_HOST` at it and nothing else
changes. The registries the ingests read (Tarmeez, the Madinah chamber, Made in
Saudi, UN Comtrade) are public endpoints; every raw response is cached under
`data/raw/` so a second run never fetches again.

---

## 3. Step by step

### Step 0. Clone and install

```bash
git clone <this repository> kamin && cd kamin
bun install
```

### Step 1. Wire the environment

```bash
cp .env.example .env
```

Bun loads `.env` from the working directory, so every command runs from the
repository root. The variables, and what reads them:

| Variable | Required | What it does |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection. The default matches `docker-compose.yml`: `postgres://kamin:kamin@localhost:5433/kamin` |
| `OLLAMA_HOST` | Yes | Where the models run. Default `http://127.0.0.1:11434`. Set to another machine's address to run the models remotely |
| `EMBEDDING_MODEL` | Yes | `ollama:bge-m3`. Only Ollama embeddings are wired |
| `COORDINATOR_MODEL` | No | Chat model for that role, as `provider:model`. Defaults to `ollama:qwen3.5:9b` |
| `DETECTIVE_MODEL`, `SPECIFIER_MODEL`, `AUDITOR_MODEL`, `ADVISOR_MODEL` | No | Same, per role. Unset means the same local default |
| `TAVILY_API_KEY` | For discovery | Web search. Without it the commands in the next table fail on their first search; everything else runs |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY` | No | Read by the provider SDKs only when a role's model is set to `anthropic:…`, `openai:…` or `deepseek:…` |
| `KAMIN_ROOT` | Set for you | The web app runs from `apps/web`, so the root scripts pass the repository path through this. You never set it by hand |

**Do you need Tavily?** Only for the agents that read the open web. Tavily is
the one search provider wired in, and there is no fallback.

| Needs `TAVILY_API_KEY` | Runs without it |
|---|---|
| `detective`, `swarm`, `hunt`, `spec:pass`, `record-cold-miss`, and "Investigate live" in the web app | Every ingest, `coordinator`, `demand:resolve`, `auditor`, `match`, `coverage`, `advisor`, `gaps`, `numbers`, `cost`, and every screen of the web app |

Search results are cached to `data/raw/tavily/` by query, so re-running a
Detective over a supplier already searched costs nothing. To swap the provider,
reimplement one function in `packages/core/src/web/tavily.ts` and keep its
return shape.

**Moving a role to a hosted model** is two lines and no code:

```
ANTHROPIC_API_KEY=sk-ant-...
AUDITOR_MODEL=anthropic:claude-sonnet-5
```

### Step 2. The database

```bash
bun run db:up      # Postgres 17 + pgvector in Docker, on port 5433
bun run migrate    # applies packages/core/src/db/migrations/*.sql in order
```

Expect `applied: 0001_graph.sql, … 0009_relations.sql` the first time and
`nothing to apply` after. `bun run db:down` stops the container and keeps the
data in the `kamin_pgdata` volume.

### Step 3. The models

```bash
ollama pull qwen3.5:9b
ollama pull bge-m3
ollama list        # both must appear
```

If Ollama is on another machine, set `OLLAMA_HOST` in `.env` to that machine's
address and port. Every agent command checks reachability first and says so if
it is not.

### Step 4. Build the map

This is the discovery limb: the registries first, then the embeddings that let
the Coordinator anchor demand to tariff codes.

```bash
bun run ingest:hs          # the HS tree: 23 sections down to 9,207 subheadings
bun run embed:hs           # bge-m3 embeddings on headings and subheadings
bun run ingest:products    # Tarmeez product registrations, keyed by tariff code
bun run ingest:plants      # every plant: suppliers, capabilities, evidence
bun run ingest:mlcp        # the Madinah chamber directory, linked by CR then by name
bun run capture:mis        # Made in Saudi member pages (needs Playwright Chromium)
bun run load:mis           # links them and writes Tier 1 evidence
```

`ingest:plants` is the long one and is resumable; pass a number to load only the
first `n` plants for a quick look, for example `bun run ingest:plants 500`.
When it finishes you should have about 14,900 suppliers and 52,000 capabilities.

### Step 5. Build the demand side

Demand is simulated on real Comtrade import values under real PIF portfolio
names, at a 12% portfolio share. That disclosure sits in the footer of every
screen. Say it out loud whenever you show the numbers.

```bash
bun run ingest:comtrade    # Saudi import values for HS 8481, 8413, 7307
bun run ingest:mining      # raw-material companies
bun run seed:mandatory     # the Mandatory List headings for the sector
bun run demand:generate    # purchase request lines, in their ERP shapes
bun run demand:resolve     # the Coordinator over every line, then pooling into orders
```

`demand:resolve` is where the Coordinator runs, about a minute a line on the
local model. Pass a limit to resolve a few at a time: `bun run demand:resolve 10`.

### Step 6. Run the agents over the map

Now the Detectives, the Specifier and the Auditors. These need Tavily.

```bash
bun run swarm 20                   # Detective then Auditor over 20 sector suppliers, resumable
bun run detective <supplierId>     # one supplier, printed as it goes
bun run auditor <capabilityId>     # one capability through the three lenses
bun run spec:pass 20               # catalogues and datasheets, specs written back
bun run hunt                       # suppliers in no registry at all
```

Each Detective run ends with a verdict on whether the pages it found describe
the same company. A "no" is a real finding and is stored as one. Supplier and
capability IDs come from the web app's URLs or from Postgres:

```bash
docker exec -it kamin-db psql -U kamin -d kamin -c \
  "select id, name_en from suppliers where detective_status = 'pending' limit 5;"
```

### Step 7. Match, cover, advise

```bash
bun run match       # every supported capability against every pooled order
bun run coverage    # spend-weighted coverage of pooled annual demand, printed
bun run advisor     # the Advisor over the manufacturing gaps
bun run gaps        # the gap ledger, as the screens show it
```

Expect coverage to read as three figures: nearly every order has a verified
plant declaring the subheading, seven in ten have a supplier that names the
product type, and none is verified at size and rating. That ladder is the point.

### Step 8. Run the web app

```bash
bun run web:dev     # Next.js on http://localhost:3000
bun run demo        # db:up then web:dev, for a cold start
```

The app reads Postgres directly through the core package and needs no separate
backend process. Screens: suppliers (the front door, paginated over the whole
map), orders and their matches, evidence chains, coverage, the graph of typed
relations, the agents, and the runs.

"Investigate live" on a pending supplier's page runs the Detective and the
Auditor on the spot, four to six minutes on the local model, and needs Ollama and
Tavily. For a room with no network, record one first:

```bash
bun run record-cold-miss <supplierId>   # saves apps/web/public/cold-miss/<id>.json
```

The page then offers "Play recording". The stage script, step by step, is
[`docs/demo-runbook.md`](docs/demo-runbook.md).

### Step 9. Measure it

```bash
bun run numbers     # every number the demo says, with its query, into docs/numbers.md
bun run cost        # seconds and tokens per role, and the same runs priced on paid models
```

### Snapshots

The whole graph can be frozen and restored, which is how a demo laptop gets a
full map without a day of ingests:

```bash
bun run db:snapshot                          # writes data/snapshots/<timestamp>.sql.gz
bun run db:restore data/snapshots/<file>     # into a clean schema, about a minute
```

Snapshots are gitignored. Ask the team for the latest one.

### Checks

```bash
bun run typecheck && bun run typecheck:web
bun test packages/core/test apps/web/test
```

Tests that need Postgres, Ollama or Tavily skip themselves when those are
unreachable. On macOS there is no `timeout` binary; cap a long run with
`perl -e 'alarm 600; exec @ARGV' bun test …`.

### The deck

The pitch deck is generated. The Arabic artboards are the source; the English
ones are derived so both stay pixel-identical.

```bash
cd deck
python3 gen2.py       # writes the Arabic artboards and canvas.json
python3 gen_en.py     # derives the English artboards
python3 render.py     # prints AR, EN and the combined PDF into deck/out/
python3 pptx_build_v2.py && python3 pptx_embed_fonts.py   # the editable .pptx
```

`render.py` uses Google Chrome headless at its default macOS path. The outputs
in `deck/out/` are committed, so nobody needs to run this to read the deck.

---

## 4. Repository layout

```
.
├── apps/web/               The product surface: Next.js 16, App Router, Tailwind v4
├── packages/core/          The agents, the data layer, the sources, the matching
│   ├── src/                One folder per concern; see packages/core/README.md
│   ├── scripts/            One entry point per `bun run` command above
│   ├── eval/               The twenty demand lines with expected answers, and the spike
│   └── test/
├── deck/                   The deck generator (gen2.py is the source of truth)
│   └── out/                Rendered PDFs and the editable .pptx
├── docs/
│   ├── CONTEXT.md          The vocabulary. Read this before the rest
│   ├── TECHNICAL.md        How it works, and what it cannot do
│   ├── COUNTS.md           Every count, token and hour, from the database
│   ├── DATA_SOURCES.md     Every source, its endpoint and its terms
│   ├── BUILD_PLAN.md       The build order
│   ├── FACTS.md            Open items, corrections, decisions owed
│   ├── numbers.md          Generated by `bun run numbers`
│   ├── demo-runbook.md     Seven minutes on stage
│   ├── adr/                Five architecture decisions, and why
│   ├── eval/               Measured evidence for the decisions
│   ├── pitch/              STORY, PITCH and the spoken script, EN and AR
│   ├── submission/         The formal submission, the pasteable answers, the brief
│   ├── design/             The UI brief and the supplier interchange schema
│   ├── notes/              Working notes
│   └── superpowers/        Milestone plans and specs, as executed
├── assets/                 The mark and the partner logos
├── infra/                  docker-compose.langfuse.yml, dev-only tracing
├── docker-compose.yml      Postgres 17 + pgvector
├── .env.example
└── package.json            Every `bun run` command lives here
```

## 5. Stack

**Runtime** Bun · TypeScript · Next.js 16 (App Router, RSC) · Tailwind v4
**Agents** LangGraph.js · LangChain model adapters
**Models** Ollama `qwen3.5:9b` (chat), `bge-m3` (embeddings); Anthropic, OpenAI
and DeepSeek adapters wired behind the same interface
**Search** Tavily, disk-cached
**Data** Postgres 17 + pgvector, one database for the graph, the vectors, the
queue and the checkpoints

## 6. Documents

| | |
|---|---|
| [`docs/CONTEXT.md`](docs/CONTEXT.md) | The vocabulary. Read this before the rest |
| [`docs/TECHNICAL.md`](docs/TECHNICAL.md) | How it actually works, and what it cannot do |
| [`docs/COUNTS.md`](docs/COUNTS.md) | Every count, token and hour, straight from the database |
| [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) | Every source, its endpoint and its terms |
| [`docs/demo-runbook.md`](docs/demo-runbook.md) | The seven-minute stage script |
| [`docs/pitch/STORY.md`](docs/pitch/STORY.md) · [`STORY_AR.md`](docs/pitch/STORY_AR.md) | The narrative |
| [`docs/pitch/PITCH.md`](docs/pitch/PITCH.md) · [`PITCH_AR.md`](docs/pitch/PITCH_AR.md) | The deck, slide by slide |
| [`docs/submission/SUBMISSION.md`](docs/submission/SUBMISSION.md) · [`SUBMISSION_AR.md`](docs/submission/SUBMISSION_AR.md) | The formal submission |
| [`deck/out/KAMIN-Pitch-Deck.pdf`](deck/out/KAMIN-Pitch-Deck.pdf) | The deck, Arabic then English |
| [`packages/core/README.md`](packages/core/README.md) | Every command with its arguments, and the source layout |

## A note on what KAMIN is not

It is not a replacement for MUSAHAMA. MUSAHAMA knows who registered. KAMIN knows
who never raised a hand. There is no login here, no upload, no approval queue: a
supplier never fills anything in, and the only destination the outreach carries
is MUSAHAMA's own registration.

---

**The team** · Mohammed Shalabi, AI-Native Principal Engineer · Ali Bamuallim,
Product Consultant · Abdulaziz Al Harthi, Data Engineer and DevOps
