# @kamin/core

The capability graph, the Tarmeez ingest, and the Coordinator run. Everything runs from the repository root with Bun.

## Prerequisites

- Bun 1.3+, Docker (OrbStack on macOS: `orbctl start`), Ollama reachable at `OLLAMA_HOST` with `qwen3.5:9b` and `bge-m3` pulled.
- A `.env` at the repository root (copy `.env.example`). Bun loads it from the working directory, so run every command from the root.

## Commands

| Command | What it does |
|---|---|
| `bun run db:up` | Starts Postgres 17 with pgvector on port 5433 |
| `bun run migrate` | Applies `packages/core/src/db/migrations/*.sql` in order |
| `bun run ingest:hs` | Loads the HS tree (23 sections to 9,207 subheadings) from Tarmeez into `hs_codes` |
| `bun run embed:hs` | Embeds headings and subheadings with bge-m3 into `hs_codes.embedding` |
| `bun run ingest:products` | Loads Tarmeez product registrations into `products` (keyed by tariff code) |
| `bun run ingest:plants [n]` | Loads all plants (or the first `n`) into `suppliers`, `capabilities`, `evidence`; resumable |
| `bun run coordinator "<line>"` | Runs the Coordinator on one purchase request line and prints the trajectory |
| `bun run spike` | Runs the twenty-line evaluation and writes `packages/core/eval/results/<model>-<time>.json` |
| `bun test packages/core/test` | All tests; database and Ollama tests skip themselves when those are unreachable |
| `bun run typecheck` | Strict TypeScript check |

Raw Tarmeez responses are cached under `data/raw/tarmeez/` (gitignored); re-runs never re-fetch.

## Layout

- `src/db` client, migration runner, SQL migrations (graph, HS codes, runs)
- `src/hs` HS code helpers and the two-stage retrieval (ADR 0005)
- `src/tarmeez` API client with disk cache, pure mapping to graph rows, upserts
- `src/models` per-role model registry (Ollama first, switchable per role by env) and the owned structured-output helper (ADR 0004)
- `src/trajectory` run and step persistence plus the LangChain callback handler that prints every step
- `src/coordinator` normalised spec schema, unit canonicalisation, lenient parse schemas, the run, pooling
- `eval` the twenty demand lines with expected answers and the spike runner

Names follow `CONTEXT.md` at the repository root. Agent workflows are runs, never graphs.
