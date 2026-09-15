# @kamin/core

The capability graph, its ingests, the four agent roles (Coordinator, Detective, Auditor, Advisor), matching, coverage and the gap ledger. Everything runs from the repository root with Bun. The screens live in `apps/web`.

## Prerequisites

- Bun 1.3+, Docker (OrbStack on macOS: `orbctl start`), Ollama reachable at `OLLAMA_HOST` with `qwen3.5:9b` and `bge-m3` pulled.
- A `.env` at the repository root (copy `.env.example`): `DATABASE_URL`, `OLLAMA_HOST`, `TAVILY_API_KEY`, and the per-role model refs (`COORDINATOR_MODEL`, `DETECTIVE_MODEL`, `AUDITOR_MODEL`, `ADVISOR_MODEL`, `EMBEDDING_MODEL`). Bun loads `.env` from the working directory, so run every command from the root.

## Commands

### Database and spine (milestone 1)

| Command | What it does |
|---|---|
| `bun run db:up` / `bun run db:down` | Starts or stops Postgres 17 with pgvector on port 5433 |
| `bun run migrate` | Applies `packages/core/src/db/migrations/*.sql` in order |
| `bun run ingest:hs` | Loads the HS tree (23 sections to 9,207 subheadings) from Tarmeez into `hs_codes` |
| `bun run embed:hs` | Embeds headings and subheadings with bge-m3 into `hs_codes.embedding` |
| `bun run ingest:products` | Loads Tarmeez product registrations into `products` (keyed by tariff code) |
| `bun run ingest:plants [n]` | Loads all plants (or the first `n`) into `suppliers`, `capabilities`, `evidence`; resumable |
| `bun run coordinator "<line>"` | Runs the Coordinator on one purchase request line and prints the trajectory |
| `bun run spike` | Runs the twenty-line evaluation and writes `packages/core/eval/results/<model>-<time>.json` |

### Detectives, Auditors and the other registries (milestone 2)

| Command | What it does |
|---|---|
| `bun run detective <supplierId>` | Investigates one supplier: Tavily search, page fetch, extraction, evidence and capability merge |
| `bun run auditor <capabilityId>` | Audits one capability through the three lenses (real, at spec, local) and writes the verdict and class |
| `bun run swarm [n]` | Detective then Auditor over the sector suppliers, `n` at a time, skipping what is already done; resumable |
| `bun run hunt` | Long-tail discovery: searches for sector suppliers absent from every registry and adds them as `discovered:*` |
| `bun run spec:pass [limit] [--hs6 848180]` | The Specifier: reads catalogues and datasheets (PDF included) of the supported suppliers that could close the most demand and writes stated sizes, ratings, materials and connections onto their capabilities, and the relations the documents state (brands distributed, group, certifiers, standards) into the `relations` edge table; `--deep` follows catalogue links one level down, `--redo` re-reads suppliers |
| `bun run ingest:mlcp` | Loads the Madinah chamber's factory directory and links it to Tarmeez suppliers by CR then by name |
| `bun run capture:mis` / `bun run load:mis` | Captures the public Made in Saudi member pages, then links them (CR first, name similarity second) and writes Tier 1 evidence |
| `bun run cost` | Seconds and tokens per role from the trajectory store, and what the same runs would cost on paid models |

### Demand, matching and the gap ledger (milestone 3)

| Command | What it does |
|---|---|
| `bun run ingest:comtrade` | Saudi import values per subheading for HS 8481, 8413 and 7307 from the Comtrade public preview |
| `bun run ingest:mining` | Mining and raw-material companies from public sources into the raw-material layer |
| `bun run seed:mandatory` | The Mandatory List headings announced for the sector, with their tranche dates |
| `bun run demand:generate [seed] [lines]` | Simulated purchase requests under real PIF portfolio names, anchored on Comtrade values times `PORTFOLIO_IMPORT_SHARE` |
| `bun run demand:resolve [limit]` | Coordinator over every unresolved demand line, then pooling into orders with a spec envelope |
| `bun run match` | Scores every supported capability against every pooled order and writes `matches` and the gap kind |
| `bun run coverage` | Spend-weighted coverage of pooled annual demand and line coverage, printed |
| `bun run advisor [limit]` | Advisor over the manufacturing gaps: adjacent suppliers, pivot candidates, investment case |
| `bun run gaps` | Prints the gap ledger as the screens show it |

### Screens and stage (milestone 4)

| Command | What it does |
|---|---|
| `bun run demo` | Starts the database and the web app on http://localhost:3000 |
| `bun run web:dev` / `bun run web:build` | Next.js dev server or production build of `apps/web` |
| `bun run record-cold-miss <supplierId>` | Runs the live cold miss once and saves its lines to `apps/web/public/cold-miss/<id>.json` for playback |
| `bun run db:snapshot [file]` / `bun run db:restore <file>` | Freezes the whole graph to `data/snapshots/`, or restores one snapshot into a clean schema |

### Checks

| Command | What it does |
|---|---|
| `bun test packages/core/test apps/web/test` | All tests; database, Ollama and Tavily tests skip themselves when those are unreachable |
| `bun run typecheck` / `bun run typecheck:web` | Strict TypeScript checks for core and web |

Raw responses from Tarmeez, MLCP, Made in Saudi, Comtrade and Tavily are cached under `data/raw/` (gitignored); re-runs never re-fetch. On macOS there is no `timeout` binary: cap a long run with `perl -e 'alarm 600; exec @ARGV' bun test …`.

## Layout

- `src/db` client, migration runner, SQL migrations (graph, HS codes, runs, registries, demand)
- `src/paths.ts` repository root and `data/` resolution, honouring `KAMIN_ROOT` when the web app runs from `apps/web`
- `src/hs` HS code helpers and the two-stage retrieval (ADR 0005)
- `src/tarmeez`, `src/mlcp`, `src/madeinsaudi`, `src/comtrade` the registry and import clients with disk caches and pure parsers
- `src/web` Tavily search and page fetch with caches
- `src/text` Arabic normalisation and name similarity used for cross-registry linking
- `src/models` per-role model registry (Ollama first, switchable per role by env) and the owned structured-output helper (ADR 0004)
- `src/trajectory` run and step persistence plus the LangChain callback handler that streams every step (ADR 0003)
- `src/coordinator` normalised spec schema, unit canonicalisation, lenient parse schemas, the run
- `src/demand` demand generation from Comtrade values and pooling into orders with envelopes
- `src/detective`, `src/auditor`, `src/advisor` the three agent roles: prompts, schemas, runs, persistence
- `src/match` scoring, persistence, coverage and gap kinds
- `src/lcgpa` the input-gated G1 score and the local-content signals shown meanwhile
- `src/graph` typed relations between entities, the explicit knowledge graph over the map
- `src/coldmiss.ts` the live cold miss: Detective then Auditor on one supplier, streaming lines
- `eval` the twenty demand lines with expected answers and the spike runner
- `scripts` one file per command in the tables above

Names follow `docs/CONTEXT.md`. Agent workflows are runs, never graphs.
