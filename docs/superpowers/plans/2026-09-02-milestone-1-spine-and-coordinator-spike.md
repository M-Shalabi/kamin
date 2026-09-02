# KAMIN Milestone 1: Tarmeez Spine and Coordinator Spike, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the whole Tarmeez catalogue (14,873 suppliers, 59,611 product lines, the 9,207-code HS tree) into Postgres as the capability graph, and prove the Coordinator can resolve messy bilingual demand lines to a specification and an HS anchor on a local model, measured on twenty hand-picked lines.

**Architecture:** One Postgres database (pgvector) holds the graph, the HS embeddings and every agent run's trajectory. Ingest is a set of Bun scripts that cache raw JSON on disk, map it with pure functions, and upsert. The Coordinator is a two-node LangGraph.js run (normalise, anchor) on a model chosen per role from the environment, Ollama first. A single callback handler writes each step to Postgres and prints it to the terminal.

**Tech Stack:** Bun 1.3, TypeScript strict, `@langchain/langgraph` 1.x, `@langchain/core` 1.x, `@langchain/ollama`, `@langchain/anthropic`, `@langchain/openai`, `@langchain/deepseek`, `zod` 4, `postgres` (porsager), `p-limit`, Docker image `pgvector/pgvector:pg17`, Ollama with `qwen3:8b` and `bge-m3`, `bun test`.

**Spec:** `BUILD_PLAN.md` (Hour 2 to 8 and Hour 16 to 28), `CONTEXT.md` (canonical names), `docs/adr/0001` to `0003`, `DATA_SOURCES.md` section "Re-test from a Saudi IP, 2026-09-02" (endpoints and counts).

## Global Constraints

- TypeScript end to end; Bun is the runtime for scripts and tests. No Python in `packages/`.
- Names come from `CONTEXT.md`: the node is `Supplier`, never `Factory`; class lives on the `Capability`; every `Evidence` has a `tier` 1 to 4; a `Capability.verdict` is `pending`, `supported` or `refuted`; `class` is `manufacturer`, `assembler`, `authorised_distributor` or `trader`.
- Agent workflows are called **runs** in code and prose, never graphs. The graph is only the capability graph.
- Models are chosen per role from env: `COORDINATOR_MODEL=ollama:qwen3:8b`, `EMBEDDING_MODEL=ollama:bge-m3`. Ollama is reached at `OLLAMA_HOST=http://100.97.185.20:11434` (this machine binds Ollama to its Tailscale address).
- Postgres runs in Docker on port **5433** (`DATABASE_URL=postgres://kamin:kamin@localhost:5433/kamin`) so it never collides with the Homebrew Postgres on 5432.
- Every run writes `runs` and `run_steps` rows and prints each step to the terminal. Nothing is logged only to a file.
- Tarmeez is a public government API: at most 4 concurrent requests, 200 ms between requests, 3 retries with backoff, a descriptive User-Agent, and every raw response cached under `data/raw/` (gitignored) so re-runs never re-fetch.
- No LC score is computed in this milestone. No em dashes in any generated text, including prompts and fixtures.
- Nothing on the user's disk is deleted by any script. Disk is tight (about 9 GB free); node modules and the Postgres image fit, Langfuse does not and is out of scope here.
- Supplier ids are prefixed by source: `tarmeez:41699`. Product ids are the Tarmeez tariff `Symbol` (10 or 12 digits). `hs6` is always the first six digits of a tariff code.

---

## File structure

```
package.json                         Bun workspaces root: packages/*, apps/*
tsconfig.base.json                   strict TS, bundler resolution, shared by packages
docker-compose.yml                   db: pgvector/pgvector:pg17 on 5433
.env.example                         every variable the code reads, with local defaults
.gitignore                           + node_modules, data/raw, eval/results, .env
packages/core/
  package.json                       name @kamin/core, scripts: migrate, test, typecheck, ingest:*, coordinator, spike
  tsconfig.json
  src/db/client.ts                   postgres.js client from DATABASE_URL (one per process)
  src/db/migrate.ts                  applies src/db/migrations/*.sql in order, tracked in schema_migrations
  src/db/migrations/0001_graph.sql   suppliers, products, capabilities, evidence, demand_lines, pooled_orders
  src/db/migrations/0002_hs_codes.sql hs_codes with vector(1024) + hnsw index
  src/db/migrations/0003_runs.sql    runs, run_steps
  src/hs/codes.ts                    pure: tariffToHs6, hsLevel, flattenCategories
  src/hs/search.ts                   kNN over hs_codes given an embedding
  src/tarmeez/client.ts              fetchJson with disk cache, rate limit, retries; listPlants, plantDetail, listProducts, categories
  src/tarmeez/map.ts                 pure: plant detail JSON -> supplier, products, capabilities, evidence rows
  src/tarmeez/load.ts                upserts for the rows above
  src/models/registry.ts             parseModelRef, getChatModel(role), getEmbeddings()
  src/trajectory/store.ts            startRun, addStep, finishRun
  src/trajectory/handler.ts          TrajectoryHandler extends BaseCallbackHandler; prints and stores
  src/coordinator/schema.ts          zod: NormalizedSpec, HsChoice
  src/coordinator/units.ts           pure: DN/inch, PN/bar, material and connection canon
  src/coordinator/nodes.ts           normalise node, anchor node (kNN + adjudication)
  src/coordinator/run.ts             StateGraph wiring; runCoordinator(rawText, portco)
  src/coordinator/pool.ts            pure: compatible(), specEnvelope(), poolLines()
  scripts/ingest-tarmeez-hs.ts       categories -> hs_codes
  scripts/ingest-tarmeez-products.ts factories/products -> products
  scripts/ingest-tarmeez-plants.ts   plants list + details -> suppliers, products, capabilities, evidence
  scripts/embed-hs.ts                bge-m3 over hs_codes level 6
  scripts/coordinator.ts             run one line from argv, print the trajectory
  eval/demand-lines.json             the twenty lines with expected answers
  eval/coordinator-spike.ts          runs all twenty, scores, writes eval/results/<model>-<ts>.json
  test/*.test.ts                     one test file per source file above
```

Tests that need Postgres are wrapped in `describe.skipIf(!process.env.DATABASE_URL)`; tests that need Ollama are wrapped in `describe.skipIf(!(await ollamaUp()))`. Pure functions are tested unconditionally.

---

### Task 1: Workspace, database container, migration runner

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `docker-compose.yml`, `.env.example`, `.gitignore` (modify), `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/db/client.ts`, `packages/core/src/db/migrate.ts`
- Test: `packages/core/test/db.test.ts`

**Interfaces:**
- Produces: `sql` (a `postgres.Sql` instance) from `src/db/client.ts`; `migrate(sql): Promise<string[]>` returns the names applied.

- [ ] **Step 1: Branch and scaffold the workspace**

```bash
cd /Users/mohammedshalabi/workspace/kamin
git checkout -b feat/milestone-1-spine
mkdir -p packages/core/src/db/migrations packages/core/test packages/core/scripts packages/core/eval data/raw
```

`package.json` (repo root):

```json
{
  "name": "kamin",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "db:up": "docker compose up -d db",
    "db:down": "docker compose down",
    "migrate": "bun run --cwd packages/core migrate",
    "test": "bun test packages/core/test",
    "typecheck": "bun run --cwd packages/core typecheck"
  }
}
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["bun-types"]
  }
}
```

`packages/core/package.json`:

```json
{
  "name": "@kamin/core",
  "private": true,
  "type": "module",
  "scripts": {
    "migrate": "bun run src/db/migrate.ts",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "ingest:hs": "bun run scripts/ingest-tarmeez-hs.ts",
    "ingest:products": "bun run scripts/ingest-tarmeez-products.ts",
    "ingest:plants": "bun run scripts/ingest-tarmeez-plants.ts",
    "embed:hs": "bun run scripts/embed-hs.ts",
    "coordinator": "bun run scripts/coordinator.ts",
    "spike": "bun run eval/coordinator-spike.ts"
  }
}
```

`packages/core/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "scripts", "eval", "test"] }
```

`docker-compose.yml`:

```yaml
services:
  db:
    image: pgvector/pgvector:pg17
    container_name: kamin-db
    ports: ["5433:5432"]
    environment:
      POSTGRES_USER: kamin
      POSTGRES_PASSWORD: kamin
      POSTGRES_DB: kamin
    volumes: ["kamin_pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kamin -d kamin"]
      interval: 5s
      timeout: 3s
      retries: 20
volumes:
  kamin_pgdata: {}
```

`.env.example`:

```
DATABASE_URL=postgres://kamin:kamin@localhost:5433/kamin
OLLAMA_HOST=http://127.0.0.1:11434
COORDINATOR_MODEL=ollama:qwen3:8b
EMBEDDING_MODEL=ollama:bge-m3
TAVILY_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
```

Append to `.gitignore`:

```
node_modules/
data/raw/
packages/core/eval/results/
*.log
```

Then add the two lines the machine needs to the real `.env` (it already holds `TAVILY_API_KEY`; do not print it):

```bash
printf 'DATABASE_URL=postgres://kamin:kamin@localhost:5433/kamin\nOLLAMA_HOST=http://100.97.185.20:11434\nCOORDINATOR_MODEL=ollama:qwen3:8b\nEMBEDDING_MODEL=ollama:bge-m3\n' >> .env
```

- [ ] **Step 2: Install dependencies**

```bash
cd packages/core
bun add @langchain/core @langchain/langgraph @langchain/ollama @langchain/anthropic @langchain/openai @langchain/deepseek zod postgres p-limit
bun add -d typescript bun-types
cd ../..
```

- [ ] **Step 3: Write the failing database test**

`packages/core/test/db.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";

describe.skipIf(!process.env.DATABASE_URL)("database", () => {
  test("connects and applies migrations idempotently", async () => {
    const first = await migrate(sql);
    const second = await migrate(sql);
    expect(second).toEqual([]);
    const [{ ok }] = await sql<{ ok: number }[]>`select 1 as ok`;
    expect(ok).toBe(1);
    const rows = await sql<{ name: string }[]>`select name from schema_migrations order by name`;
    expect(rows.map((r) => r.name)).toEqual(first.length ? first : rows.map((r) => r.name));
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `docker compose up -d db && sleep 5 && bun test packages/core/test/db.test.ts`
Expected: FAIL with "Cannot find module '../src/db/client'".

- [ ] **Step 5: Implement the client and the migration runner**

`packages/core/src/db/client.ts`:

```ts
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export const sql = postgres(url, { max: 8, onnotice: () => {} });
```

`packages/core/src/db/migrate.ts`:

```ts
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Sql } from "postgres";

const dir = join(import.meta.dir, "migrations");

export async function migrate(db: Sql): Promise<string[]> {
  await db`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const done = new Set((await db<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const body = await readFile(join(dir, file), "utf8");
    await db.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    applied.push(file);
  }
  return applied;
}

if (import.meta.main) {
  const { sql } = await import("./client");
  const applied = await migrate(sql);
  console.log(applied.length ? `applied: ${applied.join(", ")}` : "nothing to apply");
  await sql.end();
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `bun test packages/core/test/db.test.ts`
Expected: PASS (one migration folder, empty, so `first` is `[]` and both calls return `[]`).

- [ ] **Step 7: Typecheck and commit**

```bash
bun run typecheck
git add package.json tsconfig.base.json docker-compose.yml .env.example .gitignore packages/core bun.lock
git commit -m "feat(core): workspace, pgvector container and migration runner"
```

---

### Task 2: Graph schema

**Files:**
- Create: `packages/core/src/db/migrations/0001_graph.sql`
- Test: `packages/core/test/schema.test.ts`

**Interfaces:**
- Produces: tables `suppliers`, `products`, `capabilities`, `evidence`, `demand_lines`, `pooled_orders` with the columns below. Later tasks insert with exactly these names.

- [ ] **Step 1: Write the failing schema test**

`packages/core/test/schema.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";

describe.skipIf(!process.env.DATABASE_URL)("graph schema", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from suppliers where id like 'test:%'`;
  });

  test("a supplier can hold a capability with a class, a verdict and evidence", async () => {
    await sql`insert into suppliers (id, name_ar, name_en, cr_number, source) values ('test:1', 'مصنع اختبار', 'Test Plant', '1010000000', 'test')`;
    await sql`insert into products (tariff_code, hs6, title_ar, title_en, source) values ('848180000000', '848180', 'صمامات', 'Valves', 'test') on conflict do nothing`;
    const [cap] = await sql<{ id: string }[]>`
      insert into capabilities (supplier_id, tariff_code, hs6, class, verdict, declared_amount, declared_unit)
      values ('test:1', '848180000000', '848180', 'manufacturer', 'pending', 150, 'Ton') returning id`;
    await sql`insert into evidence (capability_id, tier, source_type, source_url, excerpt) values (${cap!.id}, 2, 'test', 'https://example.test', 'excerpt')`;
    const [row] = await sql<{ n: number }[]>`select count(*)::int as n from evidence where capability_id = ${cap!.id}`;
    expect(row!.n).toBe(1);
  });

  test("an invalid class is rejected", async () => {
    await expect(
      sql`insert into capabilities (supplier_id, tariff_code, hs6, class, verdict) values ('test:1', '848180000000', '848180', 'factory', 'pending')`,
    ).rejects.toThrow();
  });

  test("an invalid evidence tier is rejected", async () => {
    const [cap] = await sql<{ id: string }[]>`select id from capabilities where supplier_id = 'test:1' limit 1`;
    await expect(
      sql`insert into evidence (capability_id, tier, source_type, source_url, excerpt) values (${cap!.id}, 5, 'test', 'https://example.test', 'x')`,
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test packages/core/test/schema.test.ts`
Expected: FAIL with `relation "suppliers" does not exist`.

- [ ] **Step 3: Write the migration**

`packages/core/src/db/migrations/0001_graph.sql`:

```sql
create extension if not exists vector;

create table suppliers (
  id               text primary key,                       -- 'tarmeez:41699'
  name_ar          text,
  name_en          text,
  cr_number        text,                                   -- commercial registration number, the join key
  city_ar          text,
  city_en          text,
  region_ar        text,
  region_en        text,
  investment_type  text,
  website          text,
  email            text,
  phone            text,
  tarmeez_id       integer unique,
  tarmeez_symbol   text,
  in_tarmeez       boolean not null default false,
  in_made_in_saudi boolean not null default false,
  in_mlcp          boolean not null default false,
  source           text not null,
  raw              jsonb,
  fetched_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index suppliers_cr_idx on suppliers (cr_number);
create index suppliers_name_ar_idx on suppliers using gin (to_tsvector('simple', coalesce(name_ar, '')));

create table products (
  tariff_code text primary key,                            -- Tarmeez Symbol, 10 or 12 digits
  hs6         text not null,
  title_ar    text,
  title_en    text,
  tarmeez_id  integer,
  source      text not null,
  fetched_at  timestamptz not null default now()
);
create index products_hs6_idx on products (hs6);

create table capabilities (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     text not null references suppliers (id) on delete cascade,
  tariff_code     text not null references products (tariff_code),
  hs6             text not null,
  spec_attrs      jsonb not null default '{}'::jsonb,
  class           text not null check (class in ('manufacturer', 'assembler', 'authorised_distributor', 'trader')),
  verdict         text not null default 'pending' check (verdict in ('pending', 'supported', 'refuted')),
  confidence      real check (confidence between 0 and 1),
  declared_amount numeric,
  declared_unit   text,
  declared_lines  jsonb not null default '[]'::jsonb,
  status          text not null default 'declared',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (supplier_id, tariff_code)
);
create index capabilities_hs6_idx on capabilities (hs6);
create index capabilities_supplier_idx on capabilities (supplier_id);

create table evidence (
  id            uuid primary key default gen_random_uuid(),
  capability_id uuid not null references capabilities (id) on delete cascade,
  tier          smallint not null check (tier between 1 and 4),
  source_type   text not null,
  source_url    text not null,
  excerpt       text,
  raw           jsonb,
  fetched_at    timestamptz not null default now()
);
create index evidence_capability_idx on evidence (capability_id);

create table pooled_orders (
  id            uuid primary key default gen_random_uuid(),
  hs6           text not null,
  spec_envelope jsonb not null,
  qty_now       numeric,
  qty_annual    numeric,
  portco_count  integer not null default 0,
  created_at    timestamptz not null default now()
);

create table demand_lines (
  id              uuid primary key default gen_random_uuid(),
  raw_text        text not null,
  portco          text not null,
  source_system   text,
  language        text check (language in ('ar', 'en', 'mixed')),
  normalized_spec jsonb,
  hs6             text,
  confidence      real check (confidence between 0 and 1),
  pooled_order_id uuid references pooled_orders (id),
  run_id          uuid,
  created_at      timestamptz not null default now()
);
create index demand_lines_hs6_idx on demand_lines (hs6);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test packages/core/test/schema.test.ts`
Expected: PASS, three tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/db/migrations/0001_graph.sql packages/core/test/schema.test.ts
git commit -m "feat(core): capability graph schema with class, verdict and evidence tiers"
```

---

### Task 3: HS code helpers and the hs_codes table

**Files:**
- Create: `packages/core/src/hs/codes.ts`, `packages/core/src/db/migrations/0002_hs_codes.sql`, `packages/core/test/fixtures/tarmeez-categories-sample.json`
- Test: `packages/core/test/hs-codes.test.ts`

**Interfaces:**
- Produces: `tariffToHs6(code: string): string`, `hsLevel(symbol: string): 0 | 2 | 4 | 6`, `flattenCategories(items: TarmeezCategory[]): HsRow[]` where `HsRow = { code: string; level: 0 | 2 | 4 | 6; parent_code: string | null; title_ar: string; title_en: string }`. Table `hs_codes (code text pk, level smallint, parent_code text, title_ar text, title_en text, embedding vector(1024))`.

- [ ] **Step 1: Save a real fixture**

Copy the Tarmeez categories response captured during the probes (the first two sections are enough) to `packages/core/test/fixtures/tarmeez-categories-sample.json`. Shape, verbatim from the API:

```json
{
  "TotalCount": 23,
  "Items": [
    {
      "Title": { "Ar": "حيوانات حية ومنتجات المملكة الحيوانية", "En": "Live Animals; Animal Products" },
      "Symbol": "01-05",
      "Children": [
        {
          "Title": { "Ar": "حيوانات حية", "En": "Animals; live" },
          "Symbol": "01",
          "Children": [
            {
              "Title": { "Ar": "خيول وحمير وبغال و كوادن (نغال)، حيه", "En": "Horses, asses, mules and hinnies; live" },
              "Symbol": "0101",
              "Children": [
                { "Title": { "Ar": "خيول وحمير وبغال و كوادن (نغال)، حيه", "En": "Horses, asses, mules and hinnies; live" }, "Symbol": "010100", "Children": null }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Write the failing tests**

`packages/core/test/hs-codes.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { flattenCategories, hsLevel, tariffToHs6 } from "../src/hs/codes";
import sample from "./fixtures/tarmeez-categories-sample.json";

describe("hs codes", () => {
  test("tariffToHs6 takes the first six digits of 10 and 12 digit tariff codes", () => {
    expect(tariffToHs6("8481300005")).toBe("848130");
    expect(tariffToHs6("841581000000")).toBe("841581");
    expect(tariffToHs6("848180")).toBe("848180");
  });

  test("tariffToHs6 rejects non-numeric or short input", () => {
    expect(() => tariffToHs6("84-81")).toThrow();
    expect(() => tariffToHs6("8481")).toThrow();
  });

  test("hsLevel reads the symbol shape", () => {
    expect(hsLevel("01-05")).toBe(0);
    expect(hsLevel("01")).toBe(2);
    expect(hsLevel("0101")).toBe(4);
    expect(hsLevel("010100")).toBe(6);
  });

  test("flattenCategories yields one row per node with parent links", () => {
    const rows = flattenCategories(sample.Items);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({ code: "01-05", level: 0, parent_code: null, title_ar: "حيوانات حية ومنتجات المملكة الحيوانية", title_en: "Live Animals; Animal Products" });
    expect(rows[3]).toEqual({ code: "010100", level: 6, parent_code: "0101", title_ar: "خيول وحمير وبغال و كوادن (نغال)، حيه", title_en: "Horses, asses, mules and hinnies; live" });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun test packages/core/test/hs-codes.test.ts`
Expected: FAIL with "Cannot find module '../src/hs/codes'".

- [ ] **Step 4: Implement the helpers and the migration**

`packages/core/src/hs/codes.ts`:

```ts
export type TarmeezCategory = {
  Title: { Ar: string; En: string };
  Symbol: string;
  Children: TarmeezCategory[] | null;
};

export type HsRow = {
  code: string;
  level: 0 | 2 | 4 | 6;
  parent_code: string | null;
  title_ar: string;
  title_en: string;
};

export function tariffToHs6(code: string): string {
  if (!/^\d{6,12}$/.test(code)) throw new Error(`not a tariff code: ${code}`);
  return code.slice(0, 6);
}

export function hsLevel(symbol: string): 0 | 2 | 4 | 6 {
  if (symbol.includes("-")) return 0;
  if (symbol.length === 2) return 2;
  if (symbol.length === 4) return 4;
  if (symbol.length === 6) return 6;
  throw new Error(`unexpected HS symbol: ${symbol}`);
}

export function flattenCategories(items: TarmeezCategory[]): HsRow[] {
  const out: HsRow[] = [];
  const walk = (node: TarmeezCategory, parent: string | null) => {
    out.push({
      code: node.Symbol,
      level: hsLevel(node.Symbol),
      parent_code: parent,
      title_ar: node.Title.Ar.trim(),
      title_en: node.Title.En.trim(),
    });
    for (const child of node.Children ?? []) walk(child, node.Symbol);
  };
  for (const item of items) walk(item, null);
  return out;
}
```

`packages/core/src/db/migrations/0002_hs_codes.sql`:

```sql
create table hs_codes (
  code        text primary key,
  level       smallint not null check (level in (0, 2, 4, 6)),
  parent_code text,
  title_ar    text not null,
  title_en    text not null,
  embedding   vector(1024)
);
create index hs_codes_level_idx on hs_codes (level);
create index hs_codes_embedding_idx on hs_codes using hnsw (embedding vector_cosine_ops);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test packages/core/test/hs-codes.test.ts && bun run migrate`
Expected: PASS, four tests; migrate prints `applied: 0002_hs_codes.sql`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/hs/codes.ts packages/core/src/db/migrations/0002_hs_codes.sql packages/core/test/hs-codes.test.ts packages/core/test/fixtures/tarmeez-categories-sample.json
git commit -m "feat(core): HS code helpers and hs_codes table with pgvector column"
```

---

### Task 4: Tarmeez client with disk cache, and the HS tree ingest

**Files:**
- Create: `packages/core/src/tarmeez/client.ts`, `packages/core/scripts/ingest-tarmeez-hs.ts`
- Test: `packages/core/test/tarmeez-client.test.ts`

**Interfaces:**
- Produces: `class TarmeezClient { constructor(opts?: { fetchImpl?: typeof fetch; cacheDir?: string; concurrency?: number; delayMs?: number }) ; fetchJson<T>(path: string): Promise<T>; categories(): Promise<TarmeezCategory[]>; listPlants(): AsyncGenerator<PlantListItem>; plantDetail(id: number): Promise<PlantDetail>; listProducts(): AsyncGenerator<ProductListItem> }`.
- Types: `PlantListItem = { Id: number; Title: { Ar: string; En: string } }`; `PlantDetail = { Id: number; Title: { Ar: string; En: string }; CommercialRecordNo: string | null; Email: string | null; LegalAuthority: { Ar: string; En: string } | null; Location: { Ar: string; En: string } | null; MobileNo: string | null; PhoneNo: string | null; WebSiteUrl: string | null; Symbol: { Ar: string; En: string } | null; MainActivity: unknown; Governorate: { Ar: string; En: string } | null; InvestmentType: { Ar: string; En: string } | null; Products: PlantProduct[] | null }`; `PlantProduct = { Id: number; Title: { Ar: string; En: string }; Amount: number | null; Unit: { Ar: string; En: string } | null; Symbol: { Ar: string; En: string } }`; `ProductListItem = { Id: number; Title: { Ar: string; En: string }; Symbol: { Ar: string; En: string } }`.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/tarmeez-client.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TarmeezClient } from "../src/tarmeez/client";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("TarmeezClient", () => {
  test("caches a response on disk and does not refetch", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kamin-"));
    let calls = 0;
    const fetchImpl = (async () => { calls++; return jsonResponse({ TotalCount: 1, Items: [{ Id: 1, Title: { Ar: "أ", En: "a" } }] }); }) as typeof fetch;
    const client = new TarmeezClient({ fetchImpl, cacheDir: dir, delayMs: 0 });
    const a = await client.fetchJson<{ TotalCount: number }>("/factories/plants?pageIndex=1&pageSize=1000");
    const b = await client.fetchJson<{ TotalCount: number }>("/factories/plants?pageIndex=1&pageSize=1000");
    expect(a.TotalCount).toBe(1);
    expect(b).toEqual(a);
    expect(calls).toBe(1);
  });

  test("retries a 503 then succeeds", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kamin-"));
    let calls = 0;
    const fetchImpl = (async () => { calls++; return calls < 3 ? jsonResponse({}, 503) : jsonResponse({ ok: true }); }) as typeof fetch;
    const client = new TarmeezClient({ fetchImpl, cacheDir: dir, delayMs: 0, retryBaseMs: 1 });
    const r = await client.fetchJson<{ ok: boolean }>("/x");
    expect(r.ok).toBe(true);
    expect(calls).toBe(3);
  });

  test("listPlants pages until a short page", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kamin-"));
    const pages: Record<string, unknown> = {
      "pageIndex=1": { TotalCount: 3, Items: [{ Id: 1, Title: { Ar: "", En: "" } }, { Id: 2, Title: { Ar: "", En: "" } }] },
      "pageIndex=2": { TotalCount: 3, Items: [{ Id: 3, Title: { Ar: "", En: "" } }] },
    };
    const fetchImpl = (async (url: string | URL | Request) => {
      const u = String(url);
      const key = Object.keys(pages).find((k) => u.includes(k))!;
      return jsonResponse(pages[key]);
    }) as typeof fetch;
    const client = new TarmeezClient({ fetchImpl, cacheDir: dir, delayMs: 0, pageSize: 2 });
    const ids: number[] = [];
    for await (const p of client.listPlants()) ids.push(p.Id);
    expect(ids).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/core/test/tarmeez-client.test.ts`
Expected: FAIL with "Cannot find module '../src/tarmeez/client'".

- [ ] **Step 3: Implement the client**

`packages/core/src/tarmeez/client.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pLimit from "p-limit";
import type { TarmeezCategory } from "../hs/codes";

export const TARMEEZ_BASE = "https://psnr.mim.gov.sa/CatalogApi/api/v1";

export type Bilingual = { Ar: string; En: string };
export type PlantListItem = { Id: number; Title: Bilingual };
export type PlantProduct = { Id: number; Title: Bilingual; Amount: number | null; Unit: Bilingual | null; Symbol: Bilingual };
export type PlantDetail = {
  Id: number; Title: Bilingual; CommercialRecordNo: string | null; Email: string | null;
  LegalAuthority: Bilingual | null; Location: Bilingual | null; MobileNo: string | null; PhoneNo: string | null;
  WebSiteUrl: string | null; Symbol: Bilingual | null; MainActivity: unknown; Governorate: Bilingual | null;
  InvestmentType: Bilingual | null; Products: PlantProduct[] | null;
};
export type ProductListItem = { Id: number; Title: Bilingual; Symbol: Bilingual };
type Page<T> = { TotalCount: number; PageIndex: number; PageSize: number; Items: T[] };

export type TarmeezClientOptions = {
  fetchImpl?: typeof fetch;
  cacheDir?: string;
  concurrency?: number;
  delayMs?: number;
  retryBaseMs?: number;
  pageSize?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class TarmeezClient {
  private fetchImpl: typeof fetch;
  private cacheDir: string;
  private limit: ReturnType<typeof pLimit>;
  private delayMs: number;
  private retryBaseMs: number;
  private pageSize: number;

  constructor(opts: TarmeezClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.cacheDir = opts.cacheDir ?? join(process.cwd(), "../../data/raw/tarmeez");
    this.limit = pLimit(opts.concurrency ?? 4);
    this.delayMs = opts.delayMs ?? 200;
    this.retryBaseMs = opts.retryBaseMs ?? 500;
    this.pageSize = opts.pageSize ?? 1000;
  }

  private cachePath(path: string): string {
    return join(this.cacheDir, path.replace(/^\//, "").replace(/[^A-Za-z0-9._-]+/g, "_") + ".json");
  }

  async fetchJson<T>(path: string): Promise<T> {
    const file = this.cachePath(path);
    try {
      return JSON.parse(await readFile(file, "utf8")) as T;
    } catch {}
    return this.limit(async () => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await this.fetchImpl(TARMEEZ_BASE + path, {
            headers: { accept: "application/json", "user-agent": "KAMIN research client (PIF Innovate Hackathon)" },
          });
          if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
          if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} for ${path}`), { fatal: true });
          const body = (await res.json()) as T;
          await mkdir(this.cacheDir, { recursive: true });
          await writeFile(file, JSON.stringify(body));
          await sleep(this.delayMs);
          return body;
        } catch (err) {
          lastError = err;
          if ((err as { fatal?: boolean }).fatal) throw err;
          await sleep(this.retryBaseMs * 2 ** attempt);
        }
      }
      throw lastError;
    });
  }

  async categories(): Promise<TarmeezCategory[]> {
    const page = await this.fetchJson<Page<TarmeezCategory>>("/products/categories?pageIndex=1&pageSize=50");
    return page.Items;
  }

  private async *pages<T>(path: string, pageSize: number): AsyncGenerator<T> {
    for (let pageIndex = 1; ; pageIndex++) {
      const page = await this.fetchJson<Page<T>>(`${path}?pageIndex=${pageIndex}&pageSize=${pageSize}`);
      for (const item of page.Items) yield item;
      if (page.Items.length < pageSize) return;
    }
  }

  listPlants(): AsyncGenerator<PlantListItem> {
    return this.pages<PlantListItem>("/factories/plants", this.pageSize);
  }

  listProducts(): AsyncGenerator<ProductListItem> {
    return this.pages<ProductListItem>("/factories/products", Math.min(this.pageSize, 500));
  }

  plantDetail(id: number): Promise<PlantDetail> {
    return this.fetchJson<PlantDetail>(`/factories/plants/${id}`);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test packages/core/test/tarmeez-client.test.ts`
Expected: PASS, three tests.

- [ ] **Step 5: Write the HS ingest script and run it against the real API**

`packages/core/scripts/ingest-tarmeez-hs.ts`:

```ts
import { sql } from "../src/db/client";
import { flattenCategories } from "../src/hs/codes";
import { TarmeezClient } from "../src/tarmeez/client";

const client = new TarmeezClient();
const rows = flattenCategories(await client.categories());
console.log(`hs tree: ${rows.length} nodes`);
for (let i = 0; i < rows.length; i += 500) {
  const chunk = rows.slice(i, i + 500);
  await sql`
    insert into hs_codes ${sql(chunk, "code", "level", "parent_code", "title_ar", "title_en")}
    on conflict (code) do update set title_ar = excluded.title_ar, title_en = excluded.title_en, parent_code = excluded.parent_code, level = excluded.level`;
}
const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from hs_codes where level = 6`;
console.log(`level-6 codes in db: ${n}`);
await sql.end();
```

Run: `cd packages/core && bun run ingest:hs && cd ../..`
Expected: prints `hs tree: 10794 nodes` and `level-6 codes in db: 9207`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/tarmeez/client.ts packages/core/scripts/ingest-tarmeez-hs.ts packages/core/test/tarmeez-client.test.ts
git commit -m "feat(core): Tarmeez client with disk cache and HS tree ingest"
```

---

### Task 5: Tarmeez mapping and the spine ingest

**Files:**
- Create: `packages/core/src/tarmeez/map.ts`, `packages/core/src/tarmeez/load.ts`, `packages/core/scripts/ingest-tarmeez-products.ts`, `packages/core/scripts/ingest-tarmeez-plants.ts`, `packages/core/test/fixtures/tarmeez-plant-41699.json`
- Test: `packages/core/test/tarmeez-map.test.ts`, `packages/core/test/tarmeez-load.test.ts`

**Interfaces:**
- Produces: `mapPlant(detail: PlantDetail): { supplier: SupplierRow; products: ProductRow[]; capabilities: CapabilityRow[]; evidence: EvidenceRow[] }`; `loadPlant(sql, mapped): Promise<void>`; `loadProductList(sql, items: ProductListItem[]): Promise<number>`.
- Row types (exact column names from Task 2): `SupplierRow = { id: string; name_ar: string | null; name_en: string | null; cr_number: string | null; city_ar: string | null; city_en: string | null; region_ar: string | null; region_en: string | null; investment_type: string | null; website: string | null; email: string | null; phone: string | null; tarmeez_id: number; tarmeez_symbol: string | null; in_tarmeez: true; source: "tarmeez"; raw: unknown }`; `ProductRow = { tariff_code: string; hs6: string; title_ar: string; title_en: string; tarmeez_id: number | null; source: "tarmeez" }`; `CapabilityRow = { supplier_id: string; tariff_code: string; hs6: string; class: "manufacturer"; verdict: "pending"; declared_amount: number | null; declared_unit: string | null; declared_lines: { amount: number | null; unit: string | null }[] }`; `EvidenceRow = { supplier_id: string; tariff_code: string; tier: 2; source_type: "tarmeez_plant"; source_url: string; excerpt: string; raw: unknown }` (evidence is keyed by supplier and tariff code until the capability id exists; `loadPlant` resolves it).

- [ ] **Step 1: Save the real fixture**

`packages/core/test/fixtures/tarmeez-plant-41699.json`, verbatim from the probe (two product lines kept):

```json
{
  "Id": 41699,
  "Title": { "Ar": "مصنع شركة يوسف بن أحمد كانو للصمامات والمضخات", "En": "sharikat yusuf bin ahmad kano lilsamamat walmadkhat Factory" },
  "CommercialRecordNo": "2055024776",
  "Email": null,
  "LegalAuthority": { "Ar": "", "En": "" },
  "Location": { "Ar": "الجبيل", "En": "AlJubail" },
  "MobileNo": null,
  "PhoneNo": null,
  "WebSiteUrl": null,
  "Symbol": { "Ar": "10003066", "En": "10003066" },
  "MainActivity": null,
  "Governorate": { "Ar": "المنطقة الشرقية", "En": "Eastern Region" },
  "InvestmentType": { "Ar": "استثمار  مشترك", "En": "Mutual Investment" },
  "Products": [
    { "Id": 0, "Title": { "Ar": "848100000000 - حنفيات وصنابير وصمامات", "En": "848100000000 - Taps- cocks- valves and similar appliances for pipes" }, "Amount": 150.0, "Unit": { "Ar": "طن", "En": "Ton" }, "Symbol": { "Ar": "848100000000", "En": "848100000000" } },
    { "Id": 0, "Title": { "Ar": "848100000000 - حنفيات وصنابير وصمامات", "En": "848100000000 - Taps- cocks- valves and similar appliances for pipes" }, "Amount": 200.0, "Unit": { "Ar": "قطعة", "En": "Piece" }, "Symbol": { "Ar": "848100000000", "En": "848100000000" } }
  ]
}
```

- [ ] **Step 2: Write the failing mapping tests**

`packages/core/test/tarmeez-map.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { mapPlant } from "../src/tarmeez/map";
import plant from "./fixtures/tarmeez-plant-41699.json";
import type { PlantDetail } from "../src/tarmeez/client";

describe("mapPlant", () => {
  const mapped = mapPlant(plant as PlantDetail);

  test("maps the supplier with the CR number as join key", () => {
    expect(mapped.supplier.id).toBe("tarmeez:41699");
    expect(mapped.supplier.cr_number).toBe("2055024776");
    expect(mapped.supplier.region_en).toBe("Eastern Region");
    expect(mapped.supplier.city_ar).toBe("الجبيل");
    expect(mapped.supplier.investment_type).toBe("Mutual Investment");
    expect(mapped.supplier.website).toBeNull();
    expect(mapped.supplier.in_tarmeez).toBe(true);
  });

  test("strips the leading tariff code from product titles and derives hs6", () => {
    expect(mapped.products).toHaveLength(1);
    expect(mapped.products[0]).toMatchObject({ tariff_code: "848100000000", hs6: "848100", title_en: "Taps- cocks- valves and similar appliances for pipes", title_ar: "حنفيات وصنابير وصمامات" });
  });

  test("collapses duplicate tariff lines into one capability with declared_lines", () => {
    expect(mapped.capabilities).toHaveLength(1);
    expect(mapped.capabilities[0]).toMatchObject({ supplier_id: "tarmeez:41699", tariff_code: "848100000000", class: "manufacturer", verdict: "pending", declared_amount: 150, declared_unit: "Ton" });
    expect(mapped.capabilities[0]!.declared_lines).toEqual([{ amount: 150, unit: "Ton" }, { amount: 200, unit: "Piece" }]);
  });

  test("writes one tier-2 evidence per capability pointing at the API record", () => {
    expect(mapped.evidence).toHaveLength(1);
    expect(mapped.evidence[0]).toMatchObject({ tier: 2, source_type: "tarmeez_plant", source_url: "https://psnr.mim.gov.sa/CatalogApi/api/v1/factories/plants/41699" });
    expect(mapped.evidence[0]!.excerpt).toContain("150 Ton");
  });

  test("blank strings become null", () => {
    const m = mapPlant({ ...(plant as PlantDetail), WebSiteUrl: "  ", Email: "" });
    expect(m.supplier.website).toBeNull();
    expect(m.supplier.email).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun test packages/core/test/tarmeez-map.test.ts`
Expected: FAIL with "Cannot find module '../src/tarmeez/map'".

- [ ] **Step 4: Implement the mapping**

`packages/core/src/tarmeez/map.ts`:

```ts
import { tariffToHs6 } from "../hs/codes";
import type { PlantDetail } from "./client";

export type SupplierRow = {
  id: string; name_ar: string | null; name_en: string | null; cr_number: string | null;
  city_ar: string | null; city_en: string | null; region_ar: string | null; region_en: string | null;
  investment_type: string | null; website: string | null; email: string | null; phone: string | null;
  tarmeez_id: number; tarmeez_symbol: string | null; in_tarmeez: true; source: "tarmeez"; raw: unknown;
};
export type ProductRow = { tariff_code: string; hs6: string; title_ar: string; title_en: string; tarmeez_id: number | null; source: "tarmeez" };
export type DeclaredLine = { amount: number | null; unit: string | null };
export type CapabilityRow = {
  supplier_id: string; tariff_code: string; hs6: string; class: "manufacturer"; verdict: "pending";
  declared_amount: number | null; declared_unit: string | null; declared_lines: DeclaredLine[];
};
export type EvidenceRow = { supplier_id: string; tariff_code: string; tier: 2; source_type: "tarmeez_plant"; source_url: string; excerpt: string; raw: unknown };

const clean = (s: string | null | undefined): string | null => {
  const t = (s ?? "").trim();
  return t.length ? t : null;
};

export function stripCodePrefix(title: string): string {
  return title.replace(/^\s*\d{6,12}\s*-\s*/, "").replace(/^[\s-]+/, "").replace(/^"|"$/g, "").trim();
}

export function mapPlant(d: PlantDetail) {
  const id = `tarmeez:${d.Id}`;
  const supplier: SupplierRow = {
    id,
    name_ar: clean(d.Title?.Ar), name_en: clean(d.Title?.En),
    cr_number: clean(d.CommercialRecordNo),
    city_ar: clean(d.Location?.Ar), city_en: clean(d.Location?.En),
    region_ar: clean(d.Governorate?.Ar), region_en: clean(d.Governorate?.En),
    investment_type: clean(d.InvestmentType?.En),
    website: clean(d.WebSiteUrl), email: clean(d.Email), phone: clean(d.PhoneNo) ?? clean(d.MobileNo),
    tarmeez_id: d.Id, tarmeez_symbol: clean(d.Symbol?.En), in_tarmeez: true, source: "tarmeez", raw: d,
  };

  const products = new Map<string, ProductRow>();
  const caps = new Map<string, CapabilityRow>();
  const evidence: EvidenceRow[] = [];
  for (const p of d.Products ?? []) {
    const code = clean(p.Symbol?.En);
    if (!code || !/^\d{6,12}$/.test(code)) continue;
    const hs6 = tariffToHs6(code);
    if (!products.has(code)) {
      products.set(code, { tariff_code: code, hs6, title_ar: stripCodePrefix(p.Title?.Ar ?? ""), title_en: stripCodePrefix(p.Title?.En ?? ""), tarmeez_id: p.Id || null, source: "tarmeez" });
    }
    const line: DeclaredLine = { amount: p.Amount ?? null, unit: clean(p.Unit?.En) };
    const existing = caps.get(code);
    if (existing) {
      existing.declared_lines.push(line);
    } else {
      caps.set(code, { supplier_id: id, tariff_code: code, hs6, class: "manufacturer", verdict: "pending", declared_amount: line.amount, declared_unit: line.unit, declared_lines: [line] });
    }
  }
  for (const cap of caps.values()) {
    const product = products.get(cap.tariff_code)!;
    const lines = cap.declared_lines.map((l) => `${l.amount ?? "?"} ${l.unit ?? ""}`.trim()).join("; ");
    evidence.push({
      supplier_id: id, tariff_code: cap.tariff_code, tier: 2, source_type: "tarmeez_plant",
      source_url: `https://psnr.mim.gov.sa/CatalogApi/api/v1/factories/plants/${d.Id}`,
      excerpt: `${product.title_en} | ${product.title_ar} | declared: ${lines}`,
      raw: (d.Products ?? []).filter((p) => p.Symbol?.En === cap.tariff_code),
    });
  }
  return { supplier, products: [...products.values()], capabilities: [...caps.values()], evidence };
}
```

- [ ] **Step 5: Run the mapping tests to verify they pass**

Run: `bun test packages/core/test/tarmeez-map.test.ts`
Expected: PASS, five tests.

- [ ] **Step 6: Write the failing loader test**

`packages/core/test/tarmeez-load.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { mapPlant } from "../src/tarmeez/map";
import { loadPlant, loadProductList } from "../src/tarmeez/load";
import plant from "./fixtures/tarmeez-plant-41699.json";
import type { PlantDetail } from "../src/tarmeez/client";

describe.skipIf(!process.env.DATABASE_URL)("tarmeez load", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from suppliers where id = 'tarmeez:41699'`;
  });

  test("loadPlant upserts supplier, product, capability and evidence, idempotently", async () => {
    const mapped = mapPlant(plant as PlantDetail);
    await loadPlant(sql, mapped);
    await loadPlant(sql, mapped);
    const [s] = await sql<{ cr_number: string }[]>`select cr_number from suppliers where id = 'tarmeez:41699'`;
    expect(s!.cr_number).toBe("2055024776");
    const [c] = await sql<{ n: number }[]>`select count(*)::int as n from capabilities where supplier_id = 'tarmeez:41699'`;
    expect(c!.n).toBe(1);
    const [e] = await sql<{ n: number }[]>`select count(*)::int as n from evidence e join capabilities c on c.id = e.capability_id where c.supplier_id = 'tarmeez:41699'`;
    expect(e!.n).toBe(1);
  });

  test("loadProductList upserts by tariff code and keeps the first title", async () => {
    const n = await loadProductList(sql, [
      { Id: 19961, Title: { Ar: "صمامات لارجعية", En: "NON-RETURN VALVES" }, Symbol: { Ar: "8481300005", En: "8481300005" } },
      { Id: 19999, Title: { Ar: "x", En: "y" }, Symbol: { Ar: "8481300005", En: "8481300005" } },
    ]);
    expect(n).toBe(1);
    const [p] = await sql<{ title_en: string; hs6: string }[]>`select title_en, hs6 from products where tariff_code = '8481300005'`;
    expect(p).toEqual({ title_en: "NON-RETURN VALVES", hs6: "848130" });
  });
});
```

- [ ] **Step 7: Run the loader test to verify it fails**

Run: `bun test packages/core/test/tarmeez-load.test.ts`
Expected: FAIL with "Cannot find module '../src/tarmeez/load'".

- [ ] **Step 8: Implement the loader**

`packages/core/src/tarmeez/load.ts`:

```ts
import type { Sql } from "postgres";
import { tariffToHs6 } from "../hs/codes";
import type { ProductListItem } from "./client";
import { stripCodePrefix, type mapPlant } from "./map";

export async function loadPlant(db: Sql, m: ReturnType<typeof mapPlant>): Promise<void> {
  await db.begin(async (tx) => {
    const s = m.supplier;
    await tx`
      insert into suppliers ${tx({ ...s, raw: tx.json(s.raw as never) })}
      on conflict (id) do update set
        name_ar = excluded.name_ar, name_en = excluded.name_en, cr_number = excluded.cr_number,
        city_ar = excluded.city_ar, city_en = excluded.city_en, region_ar = excluded.region_ar, region_en = excluded.region_en,
        investment_type = excluded.investment_type, website = excluded.website, email = excluded.email, phone = excluded.phone,
        tarmeez_symbol = excluded.tarmeez_symbol, in_tarmeez = true, raw = excluded.raw, updated_at = now()`;
    if (m.products.length) {
      await tx`insert into products ${tx(m.products, "tariff_code", "hs6", "title_ar", "title_en", "tarmeez_id", "source")} on conflict (tariff_code) do nothing`;
    }
    for (const c of m.capabilities) {
      await tx`
        insert into capabilities (supplier_id, tariff_code, hs6, class, verdict, declared_amount, declared_unit, declared_lines)
        values (${c.supplier_id}, ${c.tariff_code}, ${c.hs6}, ${c.class}, ${c.verdict}, ${c.declared_amount}, ${c.declared_unit}, ${tx.json(c.declared_lines as never)})
        on conflict (supplier_id, tariff_code) do update set
          declared_amount = excluded.declared_amount, declared_unit = excluded.declared_unit, declared_lines = excluded.declared_lines, updated_at = now()`;
    }
    for (const e of m.evidence) {
      const [cap] = await tx<{ id: string }[]>`select id from capabilities where supplier_id = ${e.supplier_id} and tariff_code = ${e.tariff_code}`;
      if (!cap) continue;
      await tx`delete from evidence where capability_id = ${cap.id} and source_type = ${e.source_type}`;
      await tx`insert into evidence (capability_id, tier, source_type, source_url, excerpt, raw) values (${cap.id}, ${e.tier}, ${e.source_type}, ${e.source_url}, ${e.excerpt}, ${tx.json(e.raw as never)})`;
    }
  });
}

export async function loadProductList(db: Sql, items: ProductListItem[]): Promise<number> {
  const rows = new Map<string, { tariff_code: string; hs6: string; title_ar: string; title_en: string; tarmeez_id: number; source: "tarmeez" }>();
  for (const it of items) {
    const code = (it.Symbol?.En ?? "").trim();
    if (!/^\d{6,12}$/.test(code) || rows.has(code)) continue;
    rows.set(code, { tariff_code: code, hs6: tariffToHs6(code), title_ar: stripCodePrefix(it.Title.Ar), title_en: stripCodePrefix(it.Title.En), tarmeez_id: it.Id, source: "tarmeez" });
  }
  const list = [...rows.values()];
  for (let i = 0; i < list.length; i += 500) {
    await db`insert into products ${db(list.slice(i, i + 500), "tariff_code", "hs6", "title_ar", "title_en", "tarmeez_id", "source")} on conflict (tariff_code) do nothing`;
  }
  return list.length;
}
```

- [ ] **Step 9: Run the loader test to verify it passes**

Run: `bun test packages/core/test/tarmeez-load.test.ts`
Expected: PASS, two tests.

- [ ] **Step 10: Write the two ingest scripts**

`packages/core/scripts/ingest-tarmeez-products.ts`:

```ts
import { sql } from "../src/db/client";
import { TarmeezClient, type ProductListItem } from "../src/tarmeez/client";
import { loadProductList } from "../src/tarmeez/load";

const client = new TarmeezClient();
let batch: ProductListItem[] = [];
let total = 0;
for await (const item of client.listProducts()) {
  batch.push(item);
  if (batch.length === 2000) { total += await loadProductList(sql, batch); batch = []; console.log(`products loaded: ${total}`); }
}
if (batch.length) total += await loadProductList(sql, batch);
const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from products`;
console.log(`done. distinct tariff codes in db: ${n}`);
await sql.end();
```

`packages/core/scripts/ingest-tarmeez-plants.ts`:

```ts
import pLimit from "p-limit";
import { sql } from "../src/db/client";
import { TarmeezClient } from "../src/tarmeez/client";
import { loadPlant } from "../src/tarmeez/load";
import { mapPlant } from "../src/tarmeez/map";

const client = new TarmeezClient({ concurrency: 4, delayMs: 200 });
const only = process.argv[2] ? Number(process.argv[2]) : null; // optional: cap for a smoke run
const ids: number[] = [];
for await (const p of client.listPlants()) { ids.push(p.Id); if (only && ids.length >= only) break; }
console.log(`plants to fetch: ${ids.length}`);

const done = new Set((await sql<{ tarmeez_id: number }[]>`select tarmeez_id from suppliers where source = 'tarmeez' and raw is not null`).map((r) => r.tarmeez_id));
const todo = ids.filter((id) => !done.has(id));
console.log(`already loaded: ${done.size}, remaining: ${todo.length}`);

const limit = pLimit(4);
let n = 0, failed = 0;
await Promise.all(todo.map((id) => limit(async () => {
  try {
    const detail = await client.plantDetail(id);
    await loadPlant(sql, mapPlant(detail));
    n++;
    if (n % 200 === 0) console.log(`loaded ${n}/${todo.length}`);
  } catch (err) {
    failed++;
    console.error(`plant ${id} failed: ${(err as Error).message}`);
  }
})));
const [{ suppliers }] = await sql<{ suppliers: number }[]>`select count(*)::int as suppliers from suppliers where in_tarmeez`;
const [{ caps }] = await sql<{ caps: number }[]>`select count(*)::int as caps from capabilities`;
console.log(`done. loaded ${n}, failed ${failed}. suppliers=${suppliers} capabilities=${caps}`);
await sql.end();
```

- [ ] **Step 11: Smoke-run with a cap, then run the full ingest**

Run: `cd packages/core && bun run ingest:plants 50 && bun run ingest:products && cd ../..`
Expected: `plants to fetch: 50`, then `suppliers=50`, then `distinct tariff codes in db:` a number near 59,000 minus duplicate codes.

Run the full pass: `cd packages/core && bun run ingest:plants && cd ../..`
Expected: about 14,873 plants, `failed 0` or a handful; runtime roughly 20 to 30 minutes at 4 concurrent with a 200 ms delay. It is resumable: re-running skips loaded plants.

Verify the valve slice exists:

```bash
psql postgres://kamin:kamin@localhost:5433/kamin -c "select count(distinct supplier_id) as valve_suppliers from capabilities where hs6 like '8481%'"
```

Expected: a two- or three-digit number.

- [ ] **Step 12: Commit**

```bash
git add packages/core/src/tarmeez packages/core/scripts/ingest-tarmeez-products.ts packages/core/scripts/ingest-tarmeez-plants.ts packages/core/test/tarmeez-map.test.ts packages/core/test/tarmeez-load.test.ts packages/core/test/fixtures/tarmeez-plant-41699.json
git commit -m "feat(core): Tarmeez spine ingest into suppliers, products, capabilities and evidence"
```

---

### Task 6: Model registry

**Files:**
- Create: `packages/core/src/models/registry.ts`
- Test: `packages/core/test/registry.test.ts`

**Interfaces:**
- Produces: `parseModelRef(ref: string): { provider: "ollama" | "anthropic" | "openai" | "deepseek"; model: string }`; `getChatModel(role: "coordinator" | "detective" | "auditor" | "advisor"): BaseChatModel`; `getEmbeddings(): Embeddings`; `ollamaUp(): Promise<boolean>`; `modelRefFor(role): string`.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/registry.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { getChatModel, getEmbeddings, modelRefFor, ollamaUp, parseModelRef } from "../src/models/registry";

describe("parseModelRef", () => {
  test("splits provider from a model name that itself contains colons", () => {
    expect(parseModelRef("ollama:qwen3:8b")).toEqual({ provider: "ollama", model: "qwen3:8b" });
    expect(parseModelRef("anthropic:claude-opus-5")).toEqual({ provider: "anthropic", model: "claude-opus-5" });
    expect(parseModelRef("deepseek:deepseek-chat")).toEqual({ provider: "deepseek", model: "deepseek-chat" });
  });
  test("rejects unknown providers", () => {
    expect(() => parseModelRef("gemini:pro")).toThrow();
  });
  test("modelRefFor reads ROLE_MODEL from env with an ollama default", () => {
    process.env.AUDITOR_MODEL = "ollama:qwen3:8b";
    expect(modelRefFor("auditor")).toBe("ollama:qwen3:8b");
    delete process.env.DETECTIVE_MODEL;
    expect(modelRefFor("detective")).toBe("ollama:qwen3:8b");
  });
});

describe.skipIf(!(await ollamaUp()))("ollama models", () => {
  test("embeds a query to 1024 dims with bge-m3", async () => {
    const v = await getEmbeddings().embedQuery("ball valve");
    expect(v).toHaveLength(1024);
  });
  test("the coordinator chat model answers", async () => {
    const res = await getChatModel("coordinator").invoke("Reply with the single word: ready /no_think");
    expect(String(res.content).toLowerCase()).toContain("ready");
  }, 120_000);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/core/test/registry.test.ts`
Expected: FAIL with "Cannot find module '../src/models/registry'".

- [ ] **Step 3: Implement the registry**

`packages/core/src/models/registry.ts`:

```ts
import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Embeddings } from "@langchain/core/embeddings";
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";

export type Provider = "ollama" | "anthropic" | "openai" | "deepseek";
export type Role = "coordinator" | "detective" | "auditor" | "advisor";
const PROVIDERS: Provider[] = ["ollama", "anthropic", "openai", "deepseek"];
const DEFAULT_CHAT = "ollama:qwen3:8b";
const DEFAULT_EMBED = "ollama:bge-m3";

export const ollamaHost = () => process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";

export function parseModelRef(ref: string): { provider: Provider; model: string } {
  const i = ref.indexOf(":");
  if (i < 0) throw new Error(`model ref must look like provider:model, got ${ref}`);
  const provider = ref.slice(0, i) as Provider;
  if (!PROVIDERS.includes(provider)) throw new Error(`unknown provider ${provider}`);
  return { provider, model: ref.slice(i + 1) };
}

export function modelRefFor(role: Role): string {
  return process.env[`${role.toUpperCase()}_MODEL`] ?? DEFAULT_CHAT;
}

export function getChatModel(role: Role): BaseChatModel {
  const { provider, model } = parseModelRef(modelRefFor(role));
  switch (provider) {
    case "ollama": return new ChatOllama({ model, baseUrl: ollamaHost(), temperature: 0, numCtx: 8192 });
    case "anthropic": return new ChatAnthropic({ model, temperature: 0 });
    case "openai": return new ChatOpenAI({ model, temperature: 0 });
    case "deepseek": return new ChatDeepSeek({ model, temperature: 0 });
  }
}

export function getEmbeddings(): Embeddings {
  const { provider, model } = parseModelRef(process.env.EMBEDDING_MODEL ?? DEFAULT_EMBED);
  if (provider !== "ollama") throw new Error(`only ollama embeddings are wired in milestone 1, got ${provider}`);
  return new OllamaEmbeddings({ model, baseUrl: ollamaHost() });
}

export async function ollamaUp(): Promise<boolean> {
  try {
    const res = await fetch(`${ollamaHost()}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test packages/core/test/registry.test.ts`
Expected: PASS, five tests (the two Ollama tests run because `OLLAMA_HOST` points at the Tailscale address).

If `numCtx` is rejected by the installed `@langchain/ollama` types, the option is named `numCtx` in current releases; check `node_modules/@langchain/ollama/dist/chat_models.d.ts` and use the name found there.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/models/registry.ts packages/core/test/registry.test.ts
git commit -m "feat(core): per-role model registry, Ollama first"
```

---

### Task 7: Embed the HS tree and search it

**Files:**
- Create: `packages/core/src/hs/search.ts`, `packages/core/scripts/embed-hs.ts`
- Test: `packages/core/test/hs-search.test.ts`

**Interfaces:**
- Produces: `hsEmbeddingText(row: { title_en: string; title_ar: string; parentTitleEn?: string | null }): string`; `searchHs(db: Sql, embedding: number[], k?: number): Promise<HsHit[]>` where `HsHit = { code: string; title_en: string; title_ar: string; distance: number }`; `toVectorLiteral(v: number[]): string`.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/hs-search.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { hsEmbeddingText, searchHs, toVectorLiteral } from "../src/hs/search";
import { getEmbeddings, ollamaUp } from "../src/models/registry";

describe("hs search helpers", () => {
  test("toVectorLiteral formats for pgvector", () => {
    expect(toVectorLiteral([0.5, -1, 2])).toBe("[0.5,-1,2]");
  });
  test("hsEmbeddingText joins english, arabic and the parent heading", () => {
    expect(hsEmbeddingText({ title_en: "Check valves", title_ar: "صمامات عدم رجوع", parentTitleEn: "Taps, cocks, valves" }))
      .toBe("Check valves. صمامات عدم رجوع. Category: Taps, cocks, valves");
  });
});

describe.skipIf(!process.env.DATABASE_URL || !(await ollamaUp()))("hs search over embedded codes", () => {
  beforeAll(async () => {
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from hs_codes where level = 6 and embedding is not null`;
    if (n < 9000) throw new Error(`hs_codes not embedded yet (${n}); run bun run embed:hs first`);
  });
  test("an english valve query lands on 8481", async () => {
    const hits = await searchHs(sql, await getEmbeddings().embedQuery("stainless steel ball valve for pipes"), 5);
    expect(hits.slice(0, 3).map((h) => h.code.slice(0, 4))).toContain("8481");
  });
  test("an arabic pump query lands on 8413", async () => {
    const hits = await searchHs(sql, await getEmbeddings().embedQuery("مضخة طرد مركزي للمياه"), 5);
    expect(hits.map((h) => h.code.slice(0, 4))).toContain("8413");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/core/test/hs-search.test.ts`
Expected: FAIL with "Cannot find module '../src/hs/search'".

- [ ] **Step 3: Implement search and the embed script**

`packages/core/src/hs/search.ts`:

```ts
import type { Sql } from "postgres";

export type HsHit = { code: string; title_en: string; title_ar: string; distance: number };

export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

export function hsEmbeddingText(row: { title_en: string; title_ar: string; parentTitleEn?: string | null }): string {
  const parts = [row.title_en.trim(), row.title_ar.trim()];
  if (row.parentTitleEn) parts.push(`Category: ${row.parentTitleEn.trim()}`);
  return parts.join(". ");
}

export async function searchHs(db: Sql, embedding: number[], k = 8): Promise<HsHit[]> {
  const lit = toVectorLiteral(embedding);
  return db<HsHit[]>`
    select code, title_en, title_ar, (embedding <=> ${lit}::vector) as distance
    from hs_codes
    where level = 6 and embedding is not null
    order by embedding <=> ${lit}::vector
    limit ${k}`;
}
```

`packages/core/scripts/embed-hs.ts`:

```ts
import { sql } from "../src/db/client";
import { hsEmbeddingText, toVectorLiteral } from "../src/hs/search";
import { getEmbeddings } from "../src/models/registry";

const embeddings = getEmbeddings();
const rows = await sql<{ code: string; title_en: string; title_ar: string; parent_title_en: string | null }[]>`
  select c.code, c.title_en, c.title_ar, p.title_en as parent_title_en
  from hs_codes c left join hs_codes p on p.code = c.parent_code
  where c.level = 6 and c.embedding is null
  order by c.code`;
console.log(`to embed: ${rows.length}`);
const BATCH = 64;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const vectors = await embeddings.embedDocuments(chunk.map((r) => hsEmbeddingText({ title_en: r.title_en, title_ar: r.title_ar, parentTitleEn: r.parent_title_en })));
  await sql.begin(async (tx) => {
    for (let j = 0; j < chunk.length; j++) {
      await tx`update hs_codes set embedding = ${toVectorLiteral(vectors[j]!)}::vector where code = ${chunk[j]!.code}`;
    }
  });
  console.log(`embedded ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
}
await sql.end();
```

- [ ] **Step 4: Run the embed script, then the tests**

Run: `cd packages/core && bun run embed:hs && cd ../.. && bun test packages/core/test/hs-search.test.ts`
Expected: the script embeds 9,207 rows (several minutes on this machine); tests PASS, four tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/hs/search.ts packages/core/scripts/embed-hs.ts packages/core/test/hs-search.test.ts
git commit -m "feat(core): bge-m3 embeddings over the HS tree and kNN search"
```

---

### Task 8: Trajectory store and handler

**Files:**
- Create: `packages/core/src/db/migrations/0003_runs.sql`, `packages/core/src/trajectory/store.ts`, `packages/core/src/trajectory/handler.ts`
- Test: `packages/core/test/trajectory.test.ts`

**Interfaces:**
- Produces: `startRun(db, { role, inputRef, model }): Promise<string>` (run id); `addStep(db, runId, step: StepInput): Promise<void>` with `StepInput = { kind: "llm_call" | "tool_call" | "retrieval" | "note" | "error"; name: string; input?: unknown; output?: unknown; durationMs?: number; tokensIn?: number; tokensOut?: number }`; `finishRun(db, runId, status: "ok" | "error", error?: string): Promise<void>`; `class TrajectoryHandler extends BaseCallbackHandler` constructed with `(db, runId, { print?: boolean })`; `withRun(db, { role, inputRef, model }, fn: (runId: string, handler: TrajectoryHandler) => Promise<T>): Promise<T>`.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/trajectory.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "bun:test";
import { RunnableLambda } from "@langchain/core/runnables";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { TrajectoryHandler, withRun } from "../src/trajectory/handler";
import { addStep } from "../src/trajectory/store";

describe.skipIf(!process.env.DATABASE_URL)("trajectory", () => {
  beforeAll(async () => { await migrate(sql); });

  test("withRun records a run, its manual steps and chain callbacks, then finishes it", async () => {
    const lines: string[] = [];
    const result = await withRun(sql, { role: "coordinator", inputRef: "test-line", model: "ollama:qwen3:8b" }, async (runId, handler) => {
      handler.sink = (s) => lines.push(s);
      await addStep(sql, runId, { kind: "note", name: "hello", output: { x: 1 } });
      const chain = RunnableLambda.from(async (input: { a: number }) => ({ b: input.a + 1 })).withConfig({ runName: "add_one" });
      return chain.invoke({ a: 1 }, { callbacks: [handler] });
    });
    expect(result).toEqual({ b: 2 });
    const [run] = await sql<{ status: string; role: string }[]>`select status, role from runs where input_ref = 'test-line' order by started_at desc limit 1`;
    expect(run).toEqual({ status: "ok", role: "coordinator" });
    const steps = await sql<{ kind: string; name: string }[]>`
      select s.kind, s.name from run_steps s join runs r on r.id = s.run_id where r.input_ref = 'test-line' order by s.seq`;
    expect(steps.map((s) => s.name)).toContain("hello");
    expect(steps.map((s) => s.name)).toContain("add_one");
    expect(lines.some((l) => l.includes("add_one"))).toBe(true);
  });

  test("withRun marks a failing run as error and rethrows", async () => {
    await expect(withRun(sql, { role: "coordinator", inputRef: "boom", model: "m" }, async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    const [run] = await sql<{ status: string; error: string }[]>`select status, error from runs where input_ref = 'boom' order by started_at desc limit 1`;
    expect(run).toEqual({ status: "error", error: "boom" });
  });

  test("TrajectoryHandler has the name LangChain requires", () => {
    expect(new TrajectoryHandler(sql, "00000000-0000-0000-0000-000000000000").name).toBe("kamin_trajectory");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/core/test/trajectory.test.ts`
Expected: FAIL with "Cannot find module '../src/trajectory/handler'".

- [ ] **Step 3: Write the migration, the store and the handler**

`packages/core/src/db/migrations/0003_runs.sql`:

```sql
create table runs (
  id          uuid primary key default gen_random_uuid(),
  role        text not null check (role in ('coordinator', 'detective', 'auditor', 'advisor')),
  input_ref   text not null,
  model       text not null,
  status      text not null default 'running' check (status in ('running', 'ok', 'error')),
  error       text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index runs_role_started_idx on runs (role, started_at desc);

create table run_steps (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references runs (id) on delete cascade,
  seq         integer not null,
  kind        text not null check (kind in ('llm_call', 'tool_call', 'retrieval', 'note', 'error')),
  name        text not null,
  input       jsonb,
  output      jsonb,
  duration_ms integer,
  tokens_in   integer,
  tokens_out  integer,
  created_at  timestamptz not null default now(),
  unique (run_id, seq)
);

alter table demand_lines add constraint demand_lines_run_fk foreign key (run_id) references runs (id);
```

`packages/core/src/trajectory/store.ts`:

```ts
import type { Sql } from "postgres";

export type StepKind = "llm_call" | "tool_call" | "retrieval" | "note" | "error";
export type StepInput = { kind: StepKind; name: string; input?: unknown; output?: unknown; durationMs?: number; tokensIn?: number; tokensOut?: number };
export type RunMeta = { role: "coordinator" | "detective" | "auditor" | "advisor"; inputRef: string; model: string };

export async function startRun(db: Sql, meta: RunMeta): Promise<string> {
  const [row] = await db<{ id: string }[]>`insert into runs (role, input_ref, model) values (${meta.role}, ${meta.inputRef}, ${meta.model}) returning id`;
  return row!.id;
}

export async function addStep(db: Sql, runId: string, step: StepInput): Promise<void> {
  await db`
    insert into run_steps (run_id, seq, kind, name, input, output, duration_ms, tokens_in, tokens_out)
    values (${runId}, (select coalesce(max(seq), 0) + 1 from run_steps where run_id = ${runId}), ${step.kind}, ${step.name},
            ${step.input === undefined ? null : db.json(step.input as never)}, ${step.output === undefined ? null : db.json(step.output as never)},
            ${step.durationMs ?? null}, ${step.tokensIn ?? null}, ${step.tokensOut ?? null})`;
}

export async function finishRun(db: Sql, runId: string, status: "ok" | "error", error?: string): Promise<void> {
  await db`update runs set status = ${status}, error = ${error ?? null}, finished_at = now() where id = ${runId}`;
}
```

`packages/core/src/trajectory/handler.ts`:

```ts
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { Serialized } from "@langchain/core/load/serializable";
import type { BaseMessage } from "@langchain/core/messages";
import type { ChainValues } from "@langchain/core/utils/types";
import type { LLMResult } from "@langchain/core/outputs";
import type { Sql } from "postgres";
import { addStep, finishRun, startRun, type RunMeta, type StepInput } from "./store";

const compact = (v: unknown, max = 600): string => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + "…" : s;
};

export class TrajectoryHandler extends BaseCallbackHandler {
  name = "kamin_trajectory";
  sink: (line: string) => void = (l) => console.log(l);
  private starts = new Map<string, { name: string; input: unknown; t: number }>();
  private queue: Promise<void> = Promise.resolve();

  constructor(private db: Sql, private runId: string, private opts: { print?: boolean } = { print: true }) {
    super();
  }

  private record(step: StepInput) {
    if (this.opts.print !== false) {
      const took = step.durationMs !== undefined ? ` ${(step.durationMs / 1000).toFixed(1)}s` : "";
      const tok = step.tokensIn !== undefined ? ` ${step.tokensIn}→${step.tokensOut ?? 0} tok` : "";
      this.sink(`[${step.kind}] ${step.name}${took}${tok}${step.output !== undefined ? ` → ${compact(step.output, 300)}` : ""}`);
    }
    this.queue = this.queue.then(() => addStep(this.db, this.runId, step)).catch((e) => console.error("trajectory write failed", e));
  }

  flush(): Promise<void> { return this.queue; }

  private open(runId: string, name: string, input: unknown) { this.starts.set(runId, { name, input, t: Date.now() }); }
  private close(runId: string, kind: StepInput["kind"], output: unknown, extra: Partial<StepInput> = {}) {
    const s = this.starts.get(runId); this.starts.delete(runId);
    this.record({ kind, name: s?.name ?? "unknown", input: s?.input, output, durationMs: s ? Date.now() - s.t : undefined, ...extra });
  }

  override handleChatModelStart(_llm: Serialized, messages: BaseMessage[][], runId: string, _p?: string, _e?: unknown, _t?: string[], _m?: Record<string, unknown>, runName?: string) {
    this.open(runId, runName ?? "llm", messages.flat().map((m) => ({ role: m._getType(), content: compact(m.content, 2000) })));
  }
  override handleLLMStart(_llm: Serialized, prompts: string[], runId: string, _p?: string, _e?: unknown, _t?: string[], _m?: Record<string, unknown>, runName?: string) {
    this.open(runId, runName ?? "llm", prompts);
  }
  override handleLLMEnd(output: LLMResult, runId: string) {
    const gen = output.generations[0]?.[0] as { text?: string; message?: { usage_metadata?: { input_tokens?: number; output_tokens?: number } } } | undefined;
    const usage = gen?.message?.usage_metadata;
    this.close(runId, "llm_call", gen?.text ?? null, { tokensIn: usage?.input_tokens, tokensOut: usage?.output_tokens });
  }
  override handleLLMError(err: Error, runId: string) { this.close(runId, "error", err.message); }
  override handleChainStart(_chain: Serialized, inputs: ChainValues, runId: string, _p?: string, _t?: string[], _m?: Record<string, unknown>, _rt?: string, runName?: string) {
    this.open(runId, runName ?? "chain", inputs);
  }
  override handleChainEnd(outputs: ChainValues, runId: string) { this.close(runId, "note", outputs); }
  override handleChainError(err: Error, runId: string) { this.close(runId, "error", err.message); }
  override handleToolStart(_tool: Serialized, input: string, runId: string, _p?: string, _t?: string[], _m?: Record<string, unknown>, runName?: string) {
    this.open(runId, runName ?? "tool", input);
  }
  override handleToolEnd(output: unknown, runId: string) { this.close(runId, "tool_call", output); }
  override handleToolError(err: Error, runId: string) { this.close(runId, "error", err.message); }
}

export async function withRun<T>(db: Sql, meta: RunMeta, fn: (runId: string, handler: TrajectoryHandler) => Promise<T>): Promise<T> {
  const runId = await startRun(db, meta);
  const handler = new TrajectoryHandler(db, runId);
  handler.sink(`▶ run ${runId} ${meta.role} on ${meta.model}: ${meta.inputRef}`);
  try {
    const out = await fn(runId, handler);
    await handler.flush();
    await finishRun(db, runId, "ok");
    handler.sink(`■ run ${runId} ok`);
    return out;
  } catch (err) {
    await handler.flush();
    await finishRun(db, runId, "error", (err as Error).message);
    handler.sink(`■ run ${runId} error: ${(err as Error).message}`);
    throw err;
  }
}
```

If `tsc` reports a callback signature mismatch against the installed `@langchain/core`, open `node_modules/@langchain/core/dist/callbacks/base.d.ts` and align the parameter list; the parameter names above follow the 1.x signatures where `runName` is the last positional argument.

- [ ] **Step 4: Run migrate and the tests to verify they pass**

Run: `bun run migrate && bun test packages/core/test/trajectory.test.ts && bun run typecheck`
Expected: PASS, three tests; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/db/migrations/0003_runs.sql packages/core/src/trajectory packages/core/test/trajectory.test.ts
git commit -m "feat(core): runs and run_steps with a LangChain callback handler that prints and persists"
```

---

### Task 9: Coordinator schema and unit canonicalisation

**Files:**
- Create: `packages/core/src/coordinator/schema.ts`, `packages/core/src/coordinator/units.ts`
- Test: `packages/core/test/units.test.ts`

**Interfaces:**
- Produces: zod schemas `NormalizedSpec`, `HsChoice`; types `NormalizedSpecT`, `HsChoiceT`; `canonicalize(spec: NormalizedSpecT): NormalizedSpecT` (fills `size_dn` from `size_inch` and vice versa, `pressure_bar` from PN or psi text in `extra_attrs`, normalises `material_grade`); `DN_BY_INCH`, `inchToDn(inch: number): number | null`, `dnToInch(dn: number): number | null`, `parseSizeToken(token: string): { inch: number | null; dn: number | null } | null`, `parsePressureToken(token: string): { bar: number | null; klass: string | null } | null`, `canonMaterial(token: string): Material | null`, `canonConnection(token: string): Connection | null`.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/units.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { canonConnection, canonMaterial, canonicalize, dnToInch, inchToDn, parsePressureToken, parseSizeToken } from "../src/coordinator/units";
import { NormalizedSpec } from "../src/coordinator/schema";

describe("sizes", () => {
  test("inch and DN map both ways", () => {
    expect(inchToDn(2)).toBe(50);
    expect(inchToDn(0.5)).toBe(15);
    expect(dnToInch(100)).toBe(4);
    expect(inchToDn(7)).toBeNull();
  });
  test("parseSizeToken reads inch marks, DN and arabic digits", () => {
    expect(parseSizeToken('2"')).toEqual({ inch: 2, dn: 50 });
    expect(parseSizeToken("2IN")).toEqual({ inch: 2, dn: 50 });
    expect(parseSizeToken("DN50")).toEqual({ inch: 2, dn: 50 });
    expect(parseSizeToken("٢ بوصة")).toEqual({ inch: 2, dn: 50 });
    expect(parseSizeToken("1/2 in")).toEqual({ inch: 0.5, dn: 15 });
    expect(parseSizeToken("3/4\"")).toEqual({ inch: 0.75, dn: 20 });
    expect(parseSizeToken("banana")).toBeNull();
  });
});

describe("pressure", () => {
  test("PN, bar, psi and class tokens", () => {
    expect(parsePressureToken("PN16")).toEqual({ bar: 16, klass: null });
    expect(parsePressureToken("٤٠ بار")).toEqual({ bar: 40, klass: null });
    expect(parsePressureToken("40 bar")).toEqual({ bar: 40, klass: null });
    expect(parsePressureToken("232 psi")?.bar).toBeCloseTo(16, 0);
    expect(parsePressureToken("CL150")).toEqual({ bar: null, klass: "150" });
    expect(parsePressureToken("150#")).toEqual({ bar: null, klass: "150" });
    expect(parsePressureToken("Class 300")).toEqual({ bar: null, klass: "300" });
  });
});

describe("materials and connections", () => {
  test("arabic and english material tokens canonicalise", () => {
    expect(canonMaterial("SS316")).toBe("stainless_steel");
    expect(canonMaterial("الفولاذ المقاوم للصدأ")).toBe("stainless_steel");
    expect(canonMaterial("ستانلس ستيل")).toBe("stainless_steel");
    expect(canonMaterial("CI")).toBe("cast_iron");
    expect(canonMaterial("حديد زهر مطاوع")).toBe("ductile_iron");
    expect(canonMaterial("نحاس")).toBe("brass");
    expect(canonMaterial("CS")).toBe("carbon_steel");
    expect(canonMaterial("PVDF")).toBe("pvdf");
    expect(canonMaterial("wood")).toBeNull();
  });
  test("connection tokens canonicalise", () => {
    expect(canonConnection("FLGD")).toBe("flanged");
    expect(canonConnection("بشفة")).toBe("flanged");
    expect(canonConnection("NPT")).toBe("threaded");
    expect(canonConnection("ملولب")).toBe("threaded");
    expect(canonConnection("BW")).toBe("butt_weld");
    expect(canonConnection("لحام تناكبي")).toBe("butt_weld");
    expect(canonConnection("wafer")).toBe("wafer");
  });
});

describe("canonicalize", () => {
  test("fills the missing size unit and reads PN from extra attrs", () => {
    const spec = NormalizedSpec.parse({
      object_class: "gate valve", object_family: "valve", size_inch: null, size_dn: 100, pressure_bar: null, pressure_class: null,
      material: "cast_iron", material_grade: null, connection: "flanged", standard: null, quantity: null, quantity_unit: null,
      extra_attrs: [{ key: "pressure_rating", value: "PN16" }], english_description: "cast iron gate valve DN100 PN16 flanged", source_language: "ar",
    });
    const c = canonicalize(spec);
    expect(c.size_inch).toBe(4);
    expect(c.pressure_bar).toBe(16);
  });
  test("normalises the material grade", () => {
    const spec = NormalizedSpec.parse({
      object_class: "elbow", object_family: "fitting", size_inch: 2, size_dn: null, pressure_bar: null, pressure_class: null,
      material: "stainless_steel", material_grade: "ss 316 l", connection: "butt_weld", standard: "ASTM A403", quantity: null, quantity_unit: null,
      extra_attrs: [], english_description: "90 degree butt weld elbow 2 inch SS316L", source_language: "en",
    });
    expect(canonicalize(spec).material_grade).toBe("316L");
    expect(canonicalize(spec).size_dn).toBe(50);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/core/test/units.test.ts`
Expected: FAIL with "Cannot find module '../src/coordinator/units'".

- [ ] **Step 3: Implement the schema and the canonicaliser**

`packages/core/src/coordinator/schema.ts`:

```ts
import { z } from "zod";

export const MATERIALS = ["stainless_steel", "carbon_steel", "cast_iron", "ductile_iron", "brass", "bronze", "copper", "aluminium", "pvc", "pvdf", "pp", "hdpe", "other"] as const;
export const CONNECTIONS = ["flanged", "threaded", "butt_weld", "socket_weld", "wafer", "lug", "grooved", "push_fit", "other"] as const;
export const FAMILIES = ["valve", "pump", "fitting", "flange", "other"] as const;

export const NormalizedSpec = z.object({
  object_class: z.string().describe("The generic English name of the object, for example 'ball valve', 'gate valve', 'centrifugal pump', 'butt weld elbow', 'blind flange'"),
  object_family: z.enum(FAMILIES),
  size_inch: z.number().nullable().describe("Nominal size in inches if stated or derivable"),
  size_dn: z.number().nullable().describe("Nominal size as DN if stated"),
  pressure_bar: z.number().nullable().describe("Pressure rating in bar if stated as bar, PN or psi"),
  pressure_class: z.string().nullable().describe("ANSI/ASME class token such as '150' or '300' if stated"),
  material: z.enum(MATERIALS).nullable(),
  material_grade: z.string().nullable().describe("Grade such as '316', '316L', '304', 'A105', 'WCB'"),
  connection: z.enum(CONNECTIONS).nullable(),
  standard: z.string().nullable().describe("A named standard such as 'ASTM A403', 'BS 5163', 'API 600'"),
  quantity: z.number().nullable(),
  quantity_unit: z.string().nullable(),
  extra_attrs: z.array(z.object({ key: z.string(), value: z.string() })).describe("Anything else stated: flow, head, power, voltage, seat material, operator, schedule, face type"),
  english_description: z.string().describe("One clean English line describing the object with its key attributes"),
  source_language: z.enum(["ar", "en", "mixed"]),
});
export type NormalizedSpecT = z.infer<typeof NormalizedSpec>;

export const HsChoice = z.object({
  hs6: z.string().regex(/^\d{6}$/),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});
export type HsChoiceT = z.infer<typeof HsChoice>;
```

`packages/core/src/coordinator/units.ts`:

```ts
import { CONNECTIONS, MATERIALS, type NormalizedSpecT } from "./schema";

export type Material = (typeof MATERIALS)[number];
export type Connection = (typeof CONNECTIONS)[number];

export const DN_BY_INCH: Record<string, number> = { "0.375": 10, "0.5": 15, "0.75": 20, "1": 25, "1.25": 32, "1.5": 40, "2": 50, "2.5": 65, "3": 80, "4": 100, "5": 125, "6": 150, "8": 200, "10": 250, "12": 300, "14": 350, "16": 400, "18": 450, "20": 500, "24": 600 };

export const inchToDn = (inch: number): number | null => DN_BY_INCH[String(inch)] ?? null;
export const dnToInch = (dn: number): number | null => {
  const hit = Object.entries(DN_BY_INCH).find(([, v]) => v === dn);
  return hit ? Number(hit[0]) : null;
};

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const latinDigits = (s: string): string => s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));

const fraction = (s: string): number => {
  const m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  const mixed = s.match(/^(\d+)[\s-](\d+)\s*\/\s*(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  return Number(s.replace(",", "."));
};

export function parseSizeToken(token: string): { inch: number | null; dn: number | null } | null {
  const t = latinDigits(token).trim();
  const dn = t.match(/^DN\s*(\d+)$/i);
  if (dn) { const d = Number(dn[1]); return { inch: dnToInch(d), dn: d }; }
  const inch = t.match(/^([\d]+(?:[\s-]\d+)?(?:\s*\/\s*\d+)?(?:[.,]\d+)?)\s*(?:"|''|in\b|inch(?:es)?\b|بوصة|انش|إنش)/i);
  if (inch) { const i = fraction(inch[1]!); return { inch: i, dn: inchToDn(i) }; }
  return null;
}

export function parsePressureToken(token: string): { bar: number | null; klass: string | null } | null {
  const t = latinDigits(token).trim();
  const klass = t.match(/^(?:CL|CLASS)\s*(\d{3,4})$/i) ?? t.match(/^(\d{3,4})\s*#$/);
  if (klass) return { bar: null, klass: klass[1]! };
  const pn = t.match(/^PN\s*(\d+(?:[.,]\d+)?)$/i);
  if (pn) return { bar: Number(pn[1]!.replace(",", ".")), klass: null };
  const bar = t.match(/^(\d+(?:[.,]\d+)?)\s*(?:bar|بار)$/i);
  if (bar) return { bar: Number(bar[1]!.replace(",", ".")), klass: null };
  const psi = t.match(/^(\d+(?:[.,]\d+)?)\s*psi$/i);
  if (psi) return { bar: Number(psi[1]!.replace(",", ".")) / 14.5038, klass: null };
  const kg = t.match(/^(\d+(?:[.,]\d+)?)\s*kg\s*\/?\s*cm2?$/i);
  if (kg) return { bar: Number(kg[1]!.replace(",", ".")) * 0.980665, klass: null };
  return null;
}

const MATERIAL_TOKENS: [RegExp, Material][] = [
  [/stainless|\bss\s*\d{3}|\bss\b|ستانلس|فولاذ مقاوم للصدأ|الفولاذ المقاوم للصدأ|صلب لا يصدأ/i, "stainless_steel"],
  [/ductile|\bdi\b|حديد زهر مطاوع|حديد مطاوع/i, "ductile_iron"],
  [/cast iron|\bci\b|حديد زهر|حديد الزهر/i, "cast_iron"],
  [/carbon steel|\bcs\b|كربون ستيل|فولاذ كربوني|a105|wcb/i, "carbon_steel"],
  [/brass|نحاس أصفر|نحاس/i, "brass"],
  [/bronze|برونز/i, "bronze"],
  [/copper|نحاس أحمر/i, "copper"],
  [/alumin/i, "aluminium"],
  [/pvdf/i, "pvdf"],
  [/u?pvc|بي في سي/i, "pvc"],
  [/hdpe|polyethylene|بولي إيثيلين/i, "hdpe"],
  [/\bpp\b|polypropylene/i, "pp"],
];
export function canonMaterial(token: string): Material | null {
  for (const [re, m] of MATERIAL_TOKENS) if (re.test(token)) return m;
  return null;
}

const CONNECTION_TOKENS: [RegExp, Connection][] = [
  [/flang|flgd|بشفة|فلنج|شفة/i, "flanged"],
  [/thread|npt|bsp|ملولب|مسنن/i, "threaded"],
  [/butt\s*weld|\bbw\b|لحام تناكبي|لحام تناكب/i, "butt_weld"],
  [/socket\s*weld|\bsw\b|لحام مقبس/i, "socket_weld"],
  [/wafer|ويفر/i, "wafer"],
  [/\blug\b/i, "lug"],
  [/groov/i, "grooved"],
  [/push\s*fit/i, "push_fit"],
];
export function canonConnection(token: string): Connection | null {
  for (const [re, c] of CONNECTION_TOKENS) if (re.test(token)) return c;
  return null;
}

export function canonGrade(grade: string | null): string | null {
  if (!grade) return null;
  const g = grade.toUpperCase().replace(/\s+/g, "").replace(/^SS/, "").replace(/^AISI/, "");
  const m = g.match(/^(304|316|321|347|904)(L|H|TI)?$/);
  if (m) return m[1]! + (m[2] ?? "");
  return g.length ? g : null;
}

export function canonicalize(spec: NormalizedSpecT): NormalizedSpecT {
  const out: NormalizedSpecT = { ...spec, extra_attrs: [...spec.extra_attrs] };
  if (out.size_inch !== null && out.size_dn === null) out.size_dn = inchToDn(out.size_inch);
  if (out.size_dn !== null && out.size_inch === null) out.size_inch = dnToInch(out.size_dn);
  for (const { value } of out.extra_attrs) {
    const p = parsePressureToken(value);
    if (p?.bar !== null && p?.bar !== undefined && out.pressure_bar === null) out.pressure_bar = p.bar;
    if (p?.klass && out.pressure_class === null) out.pressure_class = p.klass;
    const s = parseSizeToken(value);
    if (s && out.size_inch === null) { out.size_inch = s.inch; out.size_dn = s.dn; }
  }
  if (out.pressure_class) out.pressure_class = out.pressure_class.replace(/[^\d]/g, "");
  out.material_grade = canonGrade(out.material_grade);
  return out;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test packages/core/test/units.test.ts`
Expected: PASS, seven tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/coordinator/schema.ts packages/core/src/coordinator/units.ts packages/core/test/units.test.ts
git commit -m "feat(core): normalised spec schema and bilingual unit canonicalisation"
```

---

### Task 10: The Coordinator run (normalise, anchor)

**Files:**
- Create: `packages/core/src/coordinator/nodes.ts`, `packages/core/src/coordinator/run.ts`, `packages/core/scripts/coordinator.ts`
- Test: `packages/core/test/coordinator.test.ts`

**Interfaces:**
- Produces: `runCoordinator(db, { rawText, portco, sourceSystem? }): Promise<CoordinatorResult>` where `CoordinatorResult = { runId: string; demandLineId: string; normalized: NormalizedSpecT; candidates: HsHit[]; hs6: string; confidence: number; reasoning: string }`; node functions `normalizeNode`, `anchorNode` exported for tests; prompt builders `normalizePrompt(rawText)`, `anchorPrompt(rawText, spec, candidates)`.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/coordinator.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { anchorPrompt, normalizePrompt } from "../src/coordinator/nodes";
import { runCoordinator } from "../src/coordinator/run";
import { ollamaUp } from "../src/models/registry";

describe("prompts", () => {
  test("normalizePrompt carries the raw line and the no-think switch", () => {
    const p = normalizePrompt("BALL VLV 2IN SS");
    expect(p.system).toContain("/no_think");
    expect(p.human).toContain("BALL VLV 2IN SS");
  });
  test("anchorPrompt lists every candidate code with both titles", () => {
    const p = anchorPrompt("x", { english_description: "ball valve" } as never, [
      { code: "848180", title_en: "Other appliances", title_ar: "غير ذلك", distance: 0.1 },
      { code: "848130", title_en: "Check valves", title_ar: "صمامات عدم رجوع", distance: 0.2 },
    ]);
    expect(p.human).toContain("848180");
    expect(p.human).toContain("صمامات عدم رجوع");
  });
});

describe.skipIf(!process.env.DATABASE_URL || !(await ollamaUp()))("runCoordinator on the local model", () => {
  beforeAll(async () => {
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from hs_codes where embedding is not null`;
    if (n < 9000) throw new Error("run bun run embed:hs first");
  });

  test("resolves an arabic ball valve line to a valve heading with a persisted run", async () => {
    const r = await runCoordinator(sql, { rawText: "صمام كروي من الفولاذ المقاوم للصدأ ٢ بوصة، ضغط ٤٠ بار", portco: "Ma'aden" });
    expect(r.hs6.slice(0, 4)).toBe("8481");
    expect(r.normalized.object_family).toBe("valve");
    expect(r.normalized.size_inch).toBe(2);
    expect(r.normalized.material).toBe("stainless_steel");
    expect(r.candidates.map((c) => c.code)).toContain(r.hs6);
    const steps = await sql<{ kind: string }[]>`select kind from run_steps where run_id = ${r.runId}`;
    expect(steps.filter((s) => s.kind === "llm_call").length).toBeGreaterThanOrEqual(2);
    expect(steps.some((s) => s.kind === "retrieval")).toBe(true);
    const [line] = await sql<{ hs6: string }[]>`select hs6 from demand_lines where id = ${r.demandLineId}`;
    expect(line!.hs6).toBe(r.hs6);
  }, 240_000);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/core/test/coordinator.test.ts`
Expected: FAIL with "Cannot find module '../src/coordinator/nodes'".

- [ ] **Step 3: Implement the nodes**

`packages/core/src/coordinator/nodes.ts`:

```ts
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { Sql } from "postgres";
import { searchHs, type HsHit } from "../hs/search";
import { getEmbeddings } from "../models/registry";
import { addStep } from "../trajectory/store";
import type { TrajectoryHandler } from "../trajectory/handler";
import { HsChoice, NormalizedSpec, type HsChoiceT, type NormalizedSpecT } from "./schema";
import { canonicalize } from "./units";

export function normalizePrompt(rawText: string): { system: string; human: string } {
  return {
    system: [
      "You normalise industrial purchase request lines from Saudi companies into a structured specification.",
      "Lines arrive in Arabic, English, or a mix, with abbreviations (VLV = valve, SS = stainless steel, CS = carbon steel, CI = cast iron, DI = ductile iron, FLGD = flanged, BW = butt weld, RF = raised face, CL150 = ANSI class 150, PN16 = 16 bar, DN50 = 2 inch).",
      "Arabic-Indic digits are ordinary digits. 'بوصة' means inch. 'بار' means bar. 'صمام كروي' is a ball valve, 'صمام بوابة' a gate valve, 'صمام فراشة' a butterfly valve, 'صمام عدم رجوع' or 'لا رجعي' a check valve, 'صمام أمان' a safety valve, 'مضخة طرد مركزي' a centrifugal pump, 'غطاس' a submersible pump, 'كوع' an elbow, 'شفة' or 'فلنجة' a flange.",
      "Fill only what the line states or what follows from it. Use null when unknown. Do not guess materials or ratings.",
      "Put flow, head, power, voltage, seat material, operator type, schedule and face type into extra_attrs.",
      "english_description is one clean English line a customs officer would understand.",
      "/no_think",
    ].join("\n"),
    human: `Purchase request line:\n${rawText}`,
  };
}

export function anchorPrompt(rawText: string, spec: NormalizedSpecT, candidates: HsHit[]): { system: string; human: string } {
  const list = candidates.map((c, i) => `${i + 1}. ${c.code}: ${c.title_en} | ${c.title_ar}`).join("\n");
  return {
    system: [
      "You are a customs classifier. Choose the single six-digit Harmonized System subheading that best fits the object.",
      "Choose only from the candidate list. Prefer the specific subheading over a residual 'other' one when the object matches it.",
      "Iron or steel pipe fittings are 7307; stainless flanges 730721; other steel flanges 730791; copper alloy fittings are 7412, not 7307; plastic fittings are 3917.",
      "Check valves are 848130, safety and relief valves 848140, pressure reducing valves 848110, other valves such as ball, gate, globe and butterfly valves 848180. Centrifugal pumps are 841370; dosing and other reciprocating positive displacement pumps 841350; rotary positive displacement pumps 841360.",
      "Return hs6, a confidence between 0 and 1, and one sentence of reasoning.",
      "/no_think",
    ].join("\n"),
    human: `Line: ${rawText}\nNormalised: ${spec.english_description}\n\nCandidates:\n${list}`,
  };
}

export async function normalizeNode(model: BaseChatModel, rawText: string, handler: TrajectoryHandler): Promise<NormalizedSpecT> {
  const p = normalizePrompt(rawText);
  const structured = model.withStructuredOutput(NormalizedSpec, { name: "normalized_spec" });
  const spec = await structured.invoke([new SystemMessage(p.system), new HumanMessage(p.human)], { callbacks: [handler], runName: "normalize" });
  return canonicalize(spec);
}

export async function retrieveCandidates(db: Sql, runId: string, spec: NormalizedSpecT, k = 8): Promise<HsHit[]> {
  const query = `${spec.object_class}. ${spec.english_description}`;
  const t = Date.now();
  const hits = await searchHs(db, await getEmbeddings().embedQuery(query), k);
  await addStep(db, runId, { kind: "retrieval", name: "hs_knn", input: { query, k }, output: hits.map((h) => ({ code: h.code, title_en: h.title_en, distance: Number(h.distance.toFixed(4)) })), durationMs: Date.now() - t });
  return hits;
}

export async function anchorNode(model: BaseChatModel, db: Sql, runId: string, rawText: string, spec: NormalizedSpecT, candidates: HsHit[], handler: TrajectoryHandler): Promise<HsChoiceT> {
  const p = anchorPrompt(rawText, spec, candidates);
  const structured = model.withStructuredOutput(HsChoice, { name: "hs_choice" });
  const choice = await structured.invoke([new SystemMessage(p.system), new HumanMessage(p.human)], { callbacks: [handler], runName: "anchor" });
  if (!candidates.some((c) => c.code === choice.hs6)) {
    await addStep(db, runId, { kind: "note", name: "anchor_outside_candidates", input: choice, output: { fallback: candidates[0]?.code } });
    return { hs6: candidates[0]!.code, confidence: Math.min(choice.confidence, 0.3), reasoning: `model chose ${choice.hs6} outside the candidate list; fell back to the nearest neighbour` };
  }
  return choice;
}
```

- [ ] **Step 4: Implement the run wiring and the CLI**

`packages/core/src/coordinator/run.ts`:

```ts
import { END, START, StateGraph, StateSchema } from "@langchain/langgraph";
import type { Sql } from "postgres";
import { z } from "zod";
import type { HsHit } from "../hs/search";
import { getChatModel, modelRefFor } from "../models/registry";
import { withRun, type TrajectoryHandler } from "../trajectory/handler";
import { anchorNode, normalizeNode, retrieveCandidates } from "./nodes";
import { NormalizedSpec, type NormalizedSpecT } from "./schema";

export type CoordinatorInput = { rawText: string; portco: string; sourceSystem?: string };
export type CoordinatorResult = { runId: string; demandLineId: string; normalized: NormalizedSpecT; candidates: HsHit[]; hs6: string; confidence: number; reasoning: string };

const State = new StateSchema({
  rawText: z.string(),
  normalized: NormalizedSpec.optional(),
  candidates: z.array(z.object({ code: z.string(), title_en: z.string(), title_ar: z.string(), distance: z.number() })).optional(),
  hs6: z.string().optional(),
  confidence: z.number().optional(),
  reasoning: z.string().optional(),
});

export function buildCoordinatorRun(db: Sql, runId: string, handler: TrajectoryHandler) {
  const model = getChatModel("coordinator");
  return new StateGraph(State)
    .addNode("normalize", async (s) => ({ normalized: await normalizeNode(model, s.rawText, handler) }))
    .addNode("retrieve", async (s) => ({ candidates: await retrieveCandidates(db, runId, s.normalized!) }))
    .addNode("anchor", async (s) => {
      const c = await anchorNode(model, db, runId, s.rawText, s.normalized!, s.candidates!, handler);
      return { hs6: c.hs6, confidence: c.confidence, reasoning: c.reasoning };
    })
    .addEdge(START, "normalize")
    .addEdge("normalize", "retrieve")
    .addEdge("retrieve", "anchor")
    .addEdge("anchor", END)
    .compile();
}

export async function runCoordinator(db: Sql, input: CoordinatorInput): Promise<CoordinatorResult> {
  return withRun(db, { role: "coordinator", inputRef: input.rawText, model: modelRefFor("coordinator") }, async (runId, handler) => {
    const run = buildCoordinatorRun(db, runId, handler);
    const out = await run.invoke({ rawText: input.rawText });
    const normalized = out.normalized!;
    const [line] = await db<{ id: string }[]>`
      insert into demand_lines (raw_text, portco, source_system, language, normalized_spec, hs6, confidence, run_id)
      values (${input.rawText}, ${input.portco}, ${input.sourceSystem ?? null}, ${normalized.source_language}, ${db.json(normalized as never)}, ${out.hs6!}, ${out.confidence!}, ${runId})
      returning id`;
    return { runId, demandLineId: line!.id, normalized, candidates: out.candidates!, hs6: out.hs6!, confidence: out.confidence!, reasoning: out.reasoning! };
  });
}
```

`packages/core/scripts/coordinator.ts`:

```ts
import { sql } from "../src/db/client";
import { runCoordinator } from "../src/coordinator/run";

const rawText = process.argv.slice(2).join(" ");
if (!rawText) { console.error("usage: bun run coordinator <purchase request line>"); process.exit(1); }
const r = await runCoordinator(sql, { rawText, portco: "cli" });
console.log("\nnormalised:", JSON.stringify(r.normalized, null, 2));
console.log(`hs6: ${r.hs6} (confidence ${r.confidence}) because ${r.reasoning}`);
await sql.end();
```

- [ ] **Step 5: Run the tests, then the CLI, to verify**

Run: `bun test packages/core/test/coordinator.test.ts && bun run typecheck`
Expected: PASS, three tests. On the local model the integration test takes tens of seconds.

Run: `cd packages/core && bun run coordinator "BALL VLV 2IN SS316 CL150 FLGD" && cd ../..`
Expected: the terminal shows `▶ run …`, an `[llm_call] normalize` line with token counts, a `[retrieval] hs_knn` line listing codes, an `[llm_call] anchor` line, `■ run … ok`, then `hs6: 848180`.

If `withStructuredOutput` on ChatOllama returns unparsable output for qwen3, add `think: false` to the ChatOllama constructor in `registry.ts` (supported by current `@langchain/ollama`); the `/no_think` soft switch in the prompts is the fallback that always works.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/coordinator/nodes.ts packages/core/src/coordinator/run.ts packages/core/scripts/coordinator.ts packages/core/test/coordinator.test.ts
git commit -m "feat(core): Coordinator run: normalise, retrieve HS candidates, anchor"
```

---

### Task 11: Pooling with a spec envelope

**Files:**
- Create: `packages/core/src/coordinator/pool.ts`
- Test: `packages/core/test/pool.test.ts`

**Interfaces:**
- Produces: `compatible(a: NormalizedSpecT, b: NormalizedSpecT): boolean`; `specEnvelope(specs: NormalizedSpecT[]): Envelope` where `Envelope = { object_class: string; object_family: string; size_inch: number | null; size_dn: number | null; pressure_bar: number | null; pressure_class: string | null; material: string | null; material_grade: string | null; connection: string | null }`; `poolLines(lines: { id: string; portco: string; hs6: string; spec: NormalizedSpecT; quantity: number | null }[]): PooledOrder[]` where `PooledOrder = { hs6: string; envelope: Envelope; lineIds: string[]; portcos: string[]; qty_now: number | null }`.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/pool.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { compatible, poolLines, specEnvelope } from "../src/coordinator/pool";
import { NormalizedSpec, type NormalizedSpecT } from "../src/coordinator/schema";

const base = (over: Partial<NormalizedSpecT>): NormalizedSpecT => NormalizedSpec.parse({
  object_class: "ball valve", object_family: "valve", size_inch: 2, size_dn: 50, pressure_bar: 40, pressure_class: null,
  material: "stainless_steel", material_grade: null, connection: null, standard: null, quantity: 12, quantity_unit: "pcs",
  extra_attrs: [], english_description: "2 inch stainless steel ball valve 40 bar", source_language: "en", ...over,
});

describe("pooling", () => {
  const a = base({});
  const b = base({ material_grade: "316", size_inch: null, size_dn: 50, quantity: 40 });
  const c = base({ pressure_bar: null, quantity: 5 });

  test("the three-line scenario pools into one order with the tightest envelope", () => {
    expect(compatible(a, b)).toBe(true);
    expect(compatible(a, c)).toBe(true);
    const env = specEnvelope([a, b, c]);
    expect(env).toMatchObject({ object_class: "ball valve", size_inch: 2, size_dn: 50, pressure_bar: 40, material: "stainless_steel", material_grade: "316" });
    const pooled = poolLines([
      { id: "A", portco: "Ma'aden", hs6: "848180", spec: a, quantity: 12 },
      { id: "B", portco: "ACWA Power", hs6: "848180", spec: b, quantity: 40 },
      { id: "C", portco: "SEC", hs6: "848180", spec: c, quantity: 5 },
    ]);
    expect(pooled).toHaveLength(1);
    expect(pooled[0]).toMatchObject({ hs6: "848180", lineIds: ["A", "B", "C"], portcos: ["Ma'aden", "ACWA Power", "SEC"], qty_now: 57 });
  });

  test("different sizes do not pool", () => {
    expect(compatible(a, base({ size_inch: 4, size_dn: 100 }))).toBe(false);
  });

  test("different object classes do not pool even under one hs6", () => {
    expect(compatible(a, base({ object_class: "gate valve" }))).toBe(false);
  });

  test("conflicting grades do not pool, a missing grade does", () => {
    expect(compatible(base({ material_grade: "304" }), base({ material_grade: "316" }))).toBe(false);
    expect(compatible(base({ material_grade: null }), base({ material_grade: "316" }))).toBe(true);
  });

  test("a stricter pressure rating tightens the envelope rather than splitting", () => {
    const env = specEnvelope([base({ pressure_bar: 16 }), base({ pressure_bar: 40 })]);
    expect(env.pressure_bar).toBe(40);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/core/test/pool.test.ts`
Expected: FAIL with "Cannot find module '../src/coordinator/pool'".

- [ ] **Step 3: Implement pooling**

`packages/core/src/coordinator/pool.ts`:

```ts
import type { NormalizedSpecT } from "./schema";

export type Envelope = {
  object_class: string; object_family: string; size_inch: number | null; size_dn: number | null;
  pressure_bar: number | null; pressure_class: string | null; material: string | null; material_grade: string | null; connection: string | null;
};
export type PoolInputLine = { id: string; portco: string; hs6: string; spec: NormalizedSpecT; quantity: number | null };
export type PooledOrder = { hs6: string; envelope: Envelope; lineIds: string[]; portcos: string[]; qty_now: number | null };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const sameOrMissing = <T>(x: T | null, y: T | null) => x === null || y === null || x === y;

export function compatible(a: NormalizedSpecT, b: NormalizedSpecT): boolean {
  if (norm(a.object_class) !== norm(b.object_class)) return false;
  if (a.object_family !== b.object_family) return false;
  const sizeA = a.size_dn ?? a.size_inch, sizeB = b.size_dn ?? b.size_inch;
  if (a.size_dn !== null && b.size_dn !== null && a.size_dn !== b.size_dn) return false;
  if (a.size_inch !== null && b.size_inch !== null && a.size_inch !== b.size_inch) return false;
  if (sizeA === null || sizeB === null) { /* a missing size is compatible */ }
  if (!sameOrMissing(a.material, b.material)) return false;
  if (!sameOrMissing(a.material_grade, b.material_grade)) return false;
  if (!sameOrMissing(a.connection, b.connection)) return false;
  if (!sameOrMissing(a.pressure_class, b.pressure_class)) return false;
  return true;
}

const tightest = (values: (number | null)[]) => values.reduce<number | null>((m, v) => (v === null ? m : m === null ? v : Math.max(m, v)), null);
const firstNonNull = <T>(values: (T | null)[]) => values.find((v) => v !== null) ?? null;

export function specEnvelope(specs: NormalizedSpecT[]): Envelope {
  const first = specs[0]!;
  return {
    object_class: norm(first.object_class), object_family: first.object_family,
    size_inch: firstNonNull(specs.map((s) => s.size_inch)), size_dn: firstNonNull(specs.map((s) => s.size_dn)),
    pressure_bar: tightest(specs.map((s) => s.pressure_bar)), pressure_class: firstNonNull(specs.map((s) => s.pressure_class)),
    material: firstNonNull(specs.map((s) => s.material)), material_grade: firstNonNull(specs.map((s) => s.material_grade)),
    connection: firstNonNull(specs.map((s) => s.connection)),
  };
}

export function poolLines(lines: PoolInputLine[]): PooledOrder[] {
  const groups: PoolInputLine[][] = [];
  for (const line of lines) {
    const g = groups.find((grp) => grp[0]!.hs6 === line.hs6 && grp.every((l) => compatible(l.spec, line.spec)));
    if (g) g.push(line); else groups.push([line]);
  }
  return groups.map((g) => ({
    hs6: g[0]!.hs6,
    envelope: specEnvelope(g.map((l) => l.spec)),
    lineIds: g.map((l) => l.id),
    portcos: [...new Set(g.map((l) => l.portco))],
    qty_now: g.some((l) => l.quantity !== null) ? g.reduce((s, l) => s + (l.quantity ?? 0), 0) : null,
  }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test packages/core/test/pool.test.ts`
Expected: PASS, five tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/coordinator/pool.ts packages/core/test/pool.test.ts
git commit -m "feat(core): pool demand lines under a spec envelope"
```

---

### Task 12: The twenty-line spike

**Files:**
- Create: `packages/core/eval/demand-lines.json`, `packages/core/eval/coordinator-spike.ts`
- Modify: `FACTS.md` section 2 (append the measured result)

**Interfaces:**
- Consumes: `runCoordinator` from Task 10, `poolLines` from Task 11.
- Produces: `eval/results/<model>-<timestamp>.json` with per-line results and a summary `{ model, hs6_correct, total, attribute_score, pooled_orders, elapsed_ms }`.

- [ ] **Step 1: Write the fixture**

`packages/core/eval/demand-lines.json` (every `expect.hs6` may be a list of acceptable codes; `expect.attrs` are checked after canonicalisation):

```json
[
  { "id": "L01", "portco": "Ma'aden", "system": "SAP MM", "raw": "صمام كروي من الفولاذ المقاوم للصدأ ٢ بوصة، ضغط ٤٠ بار", "qty": 12, "expect": { "hs6": ["848180"], "attrs": { "object_family": "valve", "size_inch": 2, "material": "stainless_steel", "pressure_bar": 40 } } },
  { "id": "L02", "portco": "ACWA Power", "system": "Oracle iProc", "raw": "BALL VLV 2IN SS316 CL150 FLGD", "qty": 40, "expect": { "hs6": ["848180"], "attrs": { "object_family": "valve", "size_inch": 2, "material": "stainless_steel", "material_grade": "316", "pressure_class": "150", "connection": "flanged" } } },
  { "id": "L03", "portco": "SEC", "system": "Excel", "raw": "Valve, ball, stainless, 2 inch, full bore", "qty": 5, "expect": { "hs6": ["848180"], "attrs": { "object_family": "valve", "size_inch": 2, "material": "stainless_steel" } } },
  { "id": "L04", "portco": "Marafiq", "system": "SAP MM", "raw": "صمام بوابة حديد زهر DN100 PN16 بشفة", "qty": 6, "expect": { "hs6": ["848180"], "attrs": { "object_family": "valve", "size_dn": 100, "material": "cast_iron", "pressure_bar": 16, "connection": "flanged" } } },
  { "id": "L05", "portco": "SEC", "system": "SAP MM", "raw": "GATE VALVE 4\" CI PN16 FLANGED BS5163", "qty": 10, "expect": { "hs6": ["848180"], "attrs": { "object_family": "valve", "size_inch": 4, "material": "cast_iron", "pressure_bar": 16, "connection": "flanged" } } },
  { "id": "L06", "portco": "ROSHN", "system": "Oracle iProc", "raw": "صمام عدم رجوع (لا رجعي) نحاس ١ بوصة ملولب", "qty": 30, "expect": { "hs6": ["848130"], "attrs": { "object_family": "valve", "size_inch": 1, "material": "brass", "connection": "threaded" } } },
  { "id": "L07", "portco": "Saudi Aramco", "system": "SAP MM", "raw": "CHK VLV SWING 6IN CS CL300 RF", "qty": 4, "expect": { "hs6": ["848130"], "attrs": { "object_family": "valve", "size_inch": 6, "material": "carbon_steel", "pressure_class": "300" } } },
  { "id": "L08", "portco": "SIRC", "system": "Excel", "raw": "صمام أمان ضغط 10 بار مدخل ½ بوصة للغلاية", "qty": 2, "expect": { "hs6": ["848140"], "attrs": { "object_family": "valve", "size_inch": 0.5, "pressure_bar": 10 } } },
  { "id": "L09", "portco": "Qiddiya", "system": "Oracle iProc", "raw": "PRESSURE REDUCING VALVE 3/4 IN BRASS 16 TO 3 BAR", "qty": 20, "expect": { "hs6": ["848110"], "attrs": { "object_family": "valve", "size_inch": 0.75, "material": "brass" } } },
  { "id": "L10", "portco": "NEOM", "system": "SAP MM", "raw": "صمام فراشة DN200 PN10 جسم حديد زهر مطاوع، قرص ستانلس، مقعد EPDM", "qty": 8, "expect": { "hs6": ["848180"], "attrs": { "object_family": "valve", "size_dn": 200, "material": "ductile_iron", "pressure_bar": 10 } } },
  { "id": "L11", "portco": "Red Sea Global", "system": "Excel", "raw": "BUTTERFLY VALVE WAFER 8\" DI/SS/EPDM PN10 W/ GEAR OPERATOR", "qty": 8, "expect": { "hs6": ["848180"], "attrs": { "object_family": "valve", "size_inch": 8, "material": "ductile_iron", "pressure_bar": 10, "connection": "wafer" } } },
  { "id": "L12", "portco": "Marafiq", "system": "SAP MM", "raw": "مضخة طرد مركزي أفقية 50 م3/س، رفع 40 م، 15 كيلوواط، 380 فولت", "qty": 2, "expect": { "hs6": ["841370"], "attrs": { "object_family": "pump" } } },
  { "id": "L13", "portco": "ACWA Power", "system": "Oracle iProc", "raw": "PUMP CENTRIFUGAL END SUCTION 50M3/HR 40M HEAD 15KW 3PH", "qty": 3, "expect": { "hs6": ["841370"], "attrs": { "object_family": "pump" } } },
  { "id": "L14", "portco": "ROSHN", "system": "Excel", "raw": "غطاس مياه صرف 5 حصان ٣ فاز مع عوامة", "qty": 6, "expect": { "hs6": ["841370", "841381"], "attrs": { "object_family": "pump" } } },
  { "id": "L15", "portco": "SIRC", "system": "SAP MM", "raw": "DOSING PUMP DIAPHRAGM 20 L/H 10 BAR PVDF HEAD 220V", "qty": 4, "expect": { "hs6": ["841350", "841381"], "attrs": { "object_family": "pump", "pressure_bar": 10 } } },
  { "id": "L16", "portco": "SABIC", "system": "SAP MM", "raw": "كوع 90 درجة ستانلس ستيل 316L قطر 2 بوصة لحام تناكبي SCH40 ASTM A403", "qty": 50, "expect": { "hs6": ["730723"], "attrs": { "object_family": "fitting", "size_inch": 2, "material": "stainless_steel", "material_grade": "316L", "connection": "butt_weld" } } },
  { "id": "L17", "portco": "Saudi Aramco", "system": "SAP MM", "raw": "ELBOW 90 LR 2\" SCH40 SS316L BW A403 WP316L", "qty": 120, "expect": { "hs6": ["730723"], "attrs": { "object_family": "fitting", "size_inch": 2, "material": "stainless_steel", "material_grade": "316L", "connection": "butt_weld" } } },
  { "id": "L18", "portco": "SEC", "system": "Oracle iProc", "raw": "شفة عمياء (بليند) كربون ستيل 4 بوصة كلاس 150 RF ASTM A105", "qty": 16, "expect": { "hs6": ["730791"], "attrs": { "object_family": "flange", "size_inch": 4, "material": "carbon_steel", "pressure_class": "150" } } },
  { "id": "L19", "portco": "Bahri", "system": "Excel", "raw": "فلنجة ستانلس ٣١٦ عنق لحام ٦ بوصة ١٥٠# ، 8 حبات", "qty": 8, "expect": { "hs6": ["730721"], "attrs": { "object_family": "flange", "size_inch": 6, "material": "stainless_steel", "material_grade": "316", "pressure_class": "150" } } },
  { "id": "L20", "portco": "Qiddiya", "system": "Excel", "raw": "NIPPLE HEX BRASS 1/2\" NPT", "qty": 200, "expect": { "hs6": ["741220"], "attrs": { "object_family": "fitting", "size_inch": 0.5, "material": "brass", "connection": "threaded" } } }
]
```

- [ ] **Step 2: Write the spike runner**

`packages/core/eval/coordinator-spike.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "../src/db/client";
import { poolLines } from "../src/coordinator/pool";
import { runCoordinator } from "../src/coordinator/run";
import { modelRefFor } from "../src/models/registry";
import lines from "./demand-lines.json";

type Line = (typeof lines)[number];
const model = modelRefFor("coordinator");
const started = Date.now();
const results: { id: string; raw: string; hs6: string | null; expected: string[]; hs6_ok: boolean; attr_hits: number; attr_total: number; confidence: number | null; ms: number; error?: string; normalized?: unknown }[] = [];
const pooled: Parameters<typeof poolLines>[0] = [];

for (const line of lines as Line[]) {
  const t = Date.now();
  try {
    const r = await runCoordinator(sql, { rawText: line.raw, portco: line.portco, sourceSystem: line.system });
    const attrs = Object.entries(line.expect.attrs);
    const hits = attrs.filter(([k, v]) => (r.normalized as Record<string, unknown>)[k] === v).length;
    results.push({ id: line.id, raw: line.raw, hs6: r.hs6, expected: line.expect.hs6, hs6_ok: line.expect.hs6.includes(r.hs6), attr_hits: hits, attr_total: attrs.length, confidence: r.confidence, ms: Date.now() - t, normalized: r.normalized });
    pooled.push({ id: line.id, portco: line.portco, hs6: r.hs6, spec: r.normalized, quantity: line.qty });
  } catch (err) {
    results.push({ id: line.id, raw: line.raw, hs6: null, expected: line.expect.hs6, hs6_ok: false, attr_hits: 0, attr_total: Object.keys(line.expect.attrs).length, confidence: null, ms: Date.now() - t, error: (err as Error).message });
  }
}

const orders = poolLines(pooled);
const summary = {
  model,
  hs6_correct: results.filter((r) => r.hs6_ok).length,
  total: results.length,
  attribute_score: Number((results.reduce((s, r) => s + r.attr_hits, 0) / results.reduce((s, r) => s + r.attr_total, 0)).toFixed(3)),
  pooled_orders: orders.length,
  pooled_groups: orders.map((o) => ({ hs6: o.hs6, lines: o.lineIds, qty_now: o.qty_now })),
  elapsed_ms: Date.now() - started,
};

console.log("\nid   ok  predicted  expected        attrs  ms");
for (const r of results) console.log(`${r.id}  ${r.hs6_ok ? "✓ " : "✗ "}  ${r.hs6 ?? "-"}     ${r.expected.join("/")}  ${r.attr_hits}/${r.attr_total}    ${r.ms}${r.error ? "  " + r.error : ""}`);
console.log(`\n${summary.hs6_correct}/${summary.total} hs6 correct, attribute score ${summary.attribute_score}, ${summary.pooled_orders} pooled orders from ${results.length} lines, model ${model}`);

const dir = join(import.meta.dir, "results");
await mkdir(dir, { recursive: true });
const file = join(dir, `${model.replace(/[^a-z0-9]+/gi, "_")}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
await writeFile(file, JSON.stringify({ summary, results }, null, 2));
console.log(`written ${file}`);
await sql.end();
```

- [ ] **Step 3: Run the spike on the default local model**

Run: `cd packages/core && bun run spike && cd ../..`
Expected: a table of twenty rows and a summary line. **Checkpoint: at least 15 of 20 hs6 correct**, and lines L01, L02 and L03 in one pooled order, L12 and L13 in one, L16 and L17 in one.

- [ ] **Step 4: Run the A/B on the other local model already on disk**

Run: `cd packages/core && COORDINATOR_MODEL=ollama:qwen3.5:9b bun run spike && cd ../..`
Expected: a second results file. Compare the two summary lines.

- [ ] **Step 5: Record the measured numbers and commit**

Append to `FACTS.md`, section 2, a bullet in this exact shape with the real numbers:

```
- **Coordinator spike, measured YYYY-MM-DD:** qwen3:8b resolved N/20 HS anchors (attribute score X), qwen3.5:9b resolved M/20 (attribute score Y); pooling produced P orders from 20 lines. Results in `packages/core/eval/results/`.
```

```bash
git add packages/core/eval/demand-lines.json packages/core/eval/coordinator-spike.ts FACTS.md
git commit -m "feat(core): twenty-line Coordinator spike with scoring and pooling"
```

If the checkpoint is not met on either local model, do not tune the prompts blindly: read the `run_steps` of the failed lines (`select name, output from run_steps where run_id = ...`), classify the failures (extraction vs retrieval vs adjudication), and fix the one stage that fails most. Retrieval failures mean the HS embedding text needs the parent heading weighted more; adjudication failures mean the candidate list is too long or the classifier rules in `anchorPrompt` need the missing case.

---

## Self-review

**Spec coverage.** BUILD_PLAN Hour 2 to 8 work items: (1) Tarmeez ingest, Tasks 4 and 5; (2) MLCP merge, deferred to milestone 2 with the Detective, since it enriches rather than builds the spine; (3) Made in Saudi, deferred to milestone 2, Playwright; (4) Mandatory List, blocked on a human download, see DATA_SOURCES; (5) Comtrade demand values, milestone 2 with the demand set; (6) number reconciliation, FACTS section 2 carries it; (7) the Coordinator spike, Tasks 9 to 12. Hour 16 to 28 Coordinator steps 1 to 3 are Tasks 9 to 10; step 4 (candidate retrieval from the graph) and step 5 (ranking) are milestone 2; pooling rule, Task 11. ADR 0001 (one Postgres), Tasks 1 to 3 and 7 to 8. ADR 0002 (registry, Ollama first), Task 6. ADR 0003 (trajectories), Task 8. CONTEXT names, every table and enum in Task 2.

**Placeholder scan.** Every code step carries the full file. The only conditional instructions are the two type-drift notes in Tasks 6 and 8, which name the exact file to open.

**Type consistency.** `HsHit` is defined once in `src/hs/search.ts` and reused by `nodes.ts` and `run.ts`; `NormalizedSpecT` from `schema.ts` is consumed by `units.ts`, `nodes.ts`, `pool.ts` and the spike; `StepInput` and `RunMeta` from `store.ts` are consumed by `handler.ts`; `mapPlant`'s return type is consumed by `loadPlant` through `ReturnType`. Column names in every `sql` call match `0001_graph.sql`, `0002_hs_codes.sql` and `0003_runs.sql`.

---

## Execution notes (2026-09-02)

Deviations from the tasks above, each with its reason, so the plan and the code agree:

- **Default model is `qwen3.5:9b`**, Mohammed's instruction; `qwen3:8b` is the A/B model. Registry, env and docs updated.
- **Scripts run from the repo root** (`bun run ingest:hs` and friends in the root `package.json`) because Bun loads `.env` from the working directory; the `TarmeezClient` resolves `data/raw` from its own file location.
- **`expect(sql\`...\`).rejects` hangs** in bun test because postgres.js queries execute lazily; rejection tests wrap the query in an async function. macOS has no `timeout`; runs are capped with `perl -e 'alarm N; exec @ARGV'`.
- **Products**: `factories/products` holds 59,611 registrations that collapse to 4,834 distinct tariff codes; the products table is keyed by tariff code, so its count is 4,834, not "near 59,000".
- **Task 7 became two-stage retrieval** (ADR 0005): `retrieveHsCandidates` replaces raw subheading kNN as the Coordinator's retrieval step, and headings (level 4) are embedded as well as subheadings.
- **Task 10 owns structured output** (ADR 0004): `invokeStructured` with lenient schemas in `coordinator/loose.ts` replaces `withStructuredOutput`; the trajectory handler records tool calls when a reply has no text.
- **Ingest totals**: 14,873 suppliers, 51,868 declared capabilities, 4,834 products, 10,672 embedded HS nodes. Valve, pump and fitting suppliers by hs6 prefix: 126, 115 and 228.
