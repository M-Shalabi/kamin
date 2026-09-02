# KAMIN Milestone 3: Demand, Matching and the Gap Ledger, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the demand side of the graph and the two numbers the pitch opens on: a simulated portfolio demand set anchored to real Comtrade import values, resolved and pooled by the Coordinator; ranked matches against audited capabilities with split fulfilment; spend-weighted coverage; the gap ledger with manufacturing and supply gaps; and Advisor investment cases per manufacturing gap with pivot candidates and a raw-materials note.

**Architecture:** Import values per HS subheading come from Comtrade into an `imports` table. A seeded generator writes messy purchase lines for real portfolio companies whose annual values sum, per subheading, to a stated share of the national import value, so every riyal traces to a trade statistic. A resumable script runs the Coordinator over the lines and persists pooled orders. Matching is a pure scoring function over the capabilities under a pooled order's subheading, with class weights, verdicts, evidence tiers and spec compatibility, and a capacity-based split. Coverage, line coverage and the two gap kinds are SQL over those tables. The Advisor is one structured call per manufacturing gap with adjacency candidates and the mining companies as context.

**Tech Stack:** As milestones 1 and 2. No new dependencies.

**Spec:** `BUILD_PLAN.md` (Hour 16 to 28 demand set, LC scoring; Hour 28 to 40 Advisor and gap ledger), `CONTEXT.md` (Demand line, Pooled order, Spec envelope, Supported capability, Coverage, Line coverage, Manufacturing gap, Supply gap, LC signal, G1 score), ADR 0001, `DATA_SOURCES.md` re-test table (Comtrade).

## Global Constraints

- Milestones 1 and 2 constraints hold. `ADVISOR_MODEL` defaults to `ollama:qwen3.5:9b`.
- Comtrade's public preview is rate limited: one request per two seconds, every response cached under `data/raw/comtrade/`, reporter 682, flow M, partner 0, period 2024, values in USD as `primaryValue`.
- The demand set is simulated and says so: every generated line carries `simulated = true`, and the portfolio share of national imports is one named constant, `PORTFOLIO_IMPORT_SHARE = 0.12`, stated in the docs and on every screen.
- Real PIF portfolio company names are used on lines (Mohammed's decision); the disclosure is global, never a per-line badge.
- Coverage counts only supported capabilities (verdict supported and at least one Tier 1 or 2 evidence). A manufacturing gap has no supported manufacturer or assembler capability; a supply gap has no supported capability of any class.
- No G1 score is ever computed from class-based assumptions: `g1Score` returns null unless every input is present.
- The Coordinator costs about a minute per line on this machine; the default demand set is 96 lines and resolution runs detached and resumable.

---

## File structure

```
packages/core/
  src/db/migrations/0005_demand.sql       imports, mandatory_list, mining_companies, matches, gap_cases; columns on demand_lines and pooled_orders
  src/comtrade/ingest.ts                  fetch import values per hs6 for the sector headings, cached and paced
  src/demand/generate.ts                  pure, seeded: generateDemand(seed, imports, opts) -> DemandSeed[]
  src/demand/pool.ts                      poolAndPersist(db): pooled_orders from resolved lines
  src/match/score.ts                      pure: compatible(envelope, cap), scoreCapability(order, cap)
  src/match/persist.ts                    matchOrder(db, orderId) -> matches with shares; matchAll(db)
  src/match/coverage.ts                   coverage(db) -> { spend, line, gaps }
  src/gaps/classify.ts                    classifyOrders(db) -> gap kind per pooled order; mandatory flag
  src/advisor/schema.ts, run.ts           InvestmentCase; runAdvisor(db, orderId)
  src/lcgpa/g1.ts, signals.ts             g1Score pure; lcSignals(db, capabilityId)
  scripts/ingest-comtrade.ts, ingest-mining.ts, seed-mandatory-list.ts
  scripts/generate-demand.ts, resolve-demand.ts, match.ts, gaps.ts, advisor.ts, coverage.ts
  test/*.test.ts
```

---

### Task 1: Demand-side schema

**Files:**
- Create: `packages/core/src/db/migrations/0005_demand.sql`
- Test: `packages/core/test/demand-schema.test.ts`

**Interfaces:**
- Produces: `imports (hs6 text, year int, reporter int, flow text, partner int, value_usd numeric, net_wgt numeric, qty numeric, fetched_at, primary key (hs6, year, reporter, flow, partner))`; `mandatory_list (hs4 text primary key, label_en, label_ar, effective_from date, source_url, note)`; `mining_companies (id int primary key, name_ar, name_en, website, email, mobile, raw jsonb)`; `demand_lines` gains `qty numeric, qty_unit text, history_factor numeric default 1, annual_value_usd numeric, seed_hs6 text, simulated boolean default true, line_key text unique`; `pooled_orders` gains `family text, title text, annual_value_usd numeric, qty_unit text, gap_kind text check in ('covered','manufacturing_gap','supply_gap') , mandatory boolean default false, updated_at`; `matches (id uuid, pooled_order_id uuid, capability_id uuid, score real, share real, rank int, reasons jsonb, unique (pooled_order_id, capability_id))`; `gap_cases (pooled_order_id uuid primary key, run_id uuid, case jsonb, created_at)`.

- [ ] **Step 1: Write the failing test**

`packages/core/test/demand-schema.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";

describe.skipIf(!process.env.DATABASE_URL)("demand schema", () => {
  beforeAll(async () => { await migrate(sql); });
  test("imports, mandatory list, matches and gap cases exist with their keys", async () => {
    await sql`insert into imports (hs6, year, reporter, flow, partner, value_usd) values ('848180', 2024, 682, 'M', 0, 1865610792) on conflict do nothing`;
    await sql`insert into mandatory_list (hs4, label_en, effective_from, source_url) values ('8481', 'Valves', '2027-08-01', 'https://www.spa.gov.sa/en/N2514218') on conflict do nothing`;
    const [o] = await sql<{ id: string }[]>`insert into pooled_orders (hs6, spec_envelope, family, title, annual_value_usd, gap_kind) values ('848180', '{}'::jsonb, 'valve', 'ball valve 2 inch', 100000, 'supply_gap') returning id`;
    await sql`insert into gap_cases (pooled_order_id, "case") values (${o!.id}, '{"headline": "x"}'::jsonb)`;
    const [row] = await sql<{ n: number }[]>`select count(*)::int as n from gap_cases where pooled_order_id = ${o!.id}`;
    expect(row!.n).toBe(1);
    await expect((async () => { await sql`insert into pooled_orders (hs6, spec_envelope, gap_kind) values ('848180', '{}'::jsonb, 'nonsense')`; })()).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/demand-schema.test.ts`
Expected: FAIL with `relation "imports" does not exist`.

- [ ] **Step 3: Write the migration**

`packages/core/src/db/migrations/0005_demand.sql`:

```sql
create table imports (
  hs6        text not null,
  year       integer not null,
  reporter   integer not null default 682,
  flow       text not null default 'M',
  partner    integer not null default 0,
  value_usd  numeric not null,
  net_wgt    numeric,
  qty        numeric,
  fetched_at timestamptz not null default now(),
  primary key (hs6, year, reporter, flow, partner)
);

create table mandatory_list (
  hs4            text primary key,
  label_en       text,
  label_ar       text,
  effective_from date,
  source_url     text,
  note           text
);

create table mining_companies (
  id      integer primary key,
  name_ar text,
  name_en text,
  website text,
  email   text,
  mobile  text,
  raw     jsonb
);

alter table demand_lines
  add column qty numeric,
  add column qty_unit text,
  add column history_factor numeric not null default 1,
  add column annual_value_usd numeric,
  add column seed_hs6 text,
  add column simulated boolean not null default true,
  add column line_key text unique;

alter table pooled_orders
  add column family text,
  add column title text,
  add column annual_value_usd numeric,
  add column qty_unit text,
  add column gap_kind text check (gap_kind in ('covered', 'manufacturing_gap', 'supply_gap')),
  add column mandatory boolean not null default false,
  add column updated_at timestamptz not null default now();
create index pooled_orders_hs6_idx on pooled_orders (hs6);
create index pooled_orders_gap_idx on pooled_orders (gap_kind);

create table matches (
  id              uuid primary key default gen_random_uuid(),
  pooled_order_id uuid not null references pooled_orders (id) on delete cascade,
  capability_id   uuid not null references capabilities (id) on delete cascade,
  score           real not null,
  share           real,
  rank            integer not null,
  reasons         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (pooled_order_id, capability_id)
);

create table gap_cases (
  pooled_order_id uuid primary key references pooled_orders (id) on delete cascade,
  run_id          uuid references runs (id),
  "case"          jsonb not null,
  created_at      timestamptz not null default now()
);
```

- [ ] **Step 4: Run migrate and the test to verify it passes**

Run: `bun run migrate && perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/demand-schema.test.ts`
Expected: `applied: 0005_demand.sql`, PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/db/migrations/0005_demand.sql packages/core/test/demand-schema.test.ts
git commit -m "feat(core): demand-side schema: imports, mandatory list, mining companies, matches, gap cases"
```

---

### Task 2: Comtrade, mining companies and the Mandatory List seed

**Files:**
- Create: `packages/core/src/comtrade/ingest.ts`, `packages/core/scripts/ingest-comtrade.ts`, `packages/core/scripts/ingest-mining.ts`, `packages/core/scripts/seed-mandatory-list.ts`
- Test: `packages/core/test/comtrade.test.ts`

**Interfaces:**
- Produces: `fetchImports(hs6s: string[], opts?: { year?: number; fetchImpl?: typeof fetch; cacheDir?: string }): Promise<ImportRow[]>` with `ImportRow = { hs6: string; year: number; value_usd: number; net_wgt: number | null; qty: number | null }`; `loadImports(db, rows): Promise<number>`; `sectorSubheadings(db, headings: string[]): Promise<string[]>`.

- [ ] **Step 1: Write the failing test**

`packages/core/test/comtrade.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchImports } from "../src/comtrade/ingest";

describe("fetchImports", () => {
  test("requests the codes in one paced call, maps primaryValue, and caches", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kamin-comtrade-"));
    let calls = 0;
    const fetchImpl = (async (u: string | URL | Request) => {
      calls++;
      expect(String(u)).toContain("cmdCode=848180,848130");
      return new Response(JSON.stringify({ count: 2, data: [
        { cmdCode: "848180", period: "2024", primaryValue: 1865610792.026, netWgt: 113392119.54, qty: 113392119.54 },
        { cmdCode: "848130", period: "2024", primaryValue: 142800000, netWgt: null, qty: null },
      ] }), { status: 200 });
    }) as unknown as typeof fetch;
    const a = await fetchImports(["848180", "848130"], { fetchImpl, cacheDir: dir, delayMs: 0 });
    const b = await fetchImports(["848180", "848130"], { fetchImpl, cacheDir: dir, delayMs: 0 });
    expect(a).toEqual([{ hs6: "848180", year: 2024, value_usd: 1865610792.026, net_wgt: 113392119.54, qty: 113392119.54 }, { hs6: "848130", year: 2024, value_usd: 142800000, net_wgt: null, qty: null }]);
    expect(b).toEqual(a);
    expect(calls).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/comtrade.test.ts`
Expected: FAIL with "Cannot find module '../src/comtrade/ingest'".

- [ ] **Step 3: Implement ingest and the three scripts**

`packages/core/src/comtrade/ingest.ts`:

```ts
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Sql } from "postgres";

const REPO_ROOT = join(import.meta.dir, "../../../..");
export type ImportRow = { hs6: string; year: number; value_usd: number; net_wgt: number | null; qty: number | null };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchImports(hs6s: string[], opts: { year?: number; fetchImpl?: typeof fetch; cacheDir?: string; delayMs?: number } = {}): Promise<ImportRow[]> {
  const year = opts.year ?? 2024;
  const cacheDir = opts.cacheDir ?? join(REPO_ROOT, "data/raw/comtrade");
  const out: ImportRow[] = [];
  for (let i = 0; i < hs6s.length; i += 40) {
    const codes = hs6s.slice(i, i + 40);
    const url = `https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=682&period=${year}&cmdCode=${codes.join(",")}&flowCode=M&partnerCode=0`;
    const file = join(cacheDir, createHash("sha1").update(url).digest("hex") + ".json");
    let body: { data?: { cmdCode: string; period: string; primaryValue: number; netWgt: number | null; qty: number | null }[] };
    try {
      body = JSON.parse(await readFile(file, "utf8"));
    } catch {
      const res = await (opts.fetchImpl ?? fetch)(url, { headers: { "user-agent": "KAMIN research client (PIF Innovate Hackathon)" }, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`comtrade ${res.status}`);
      body = (await res.json()) as typeof body;
      await mkdir(cacheDir, { recursive: true });
      await writeFile(file, JSON.stringify(body));
      await sleep(opts.delayMs ?? 2500);
    }
    for (const r of body.data ?? []) out.push({ hs6: r.cmdCode, year: Number(r.period), value_usd: Number(r.primaryValue), net_wgt: r.netWgt === null || r.netWgt === undefined ? null : Number(r.netWgt), qty: r.qty === null || r.qty === undefined ? null : Number(r.qty) });
  }
  return out;
}

export async function sectorSubheadings(db: Sql, headings: string[]): Promise<string[]> {
  const rows = await db<{ code: string }[]>`select code from hs_codes where level = 6 and parent_code = any(${headings}) order by code`;
  return rows.map((r) => r.code);
}

export async function loadImports(db: Sql, rows: ImportRow[]): Promise<number> {
  for (const r of rows) {
    await db`insert into imports (hs6, year, value_usd, net_wgt, qty) values (${r.hs6}, ${r.year}, ${r.value_usd}, ${r.net_wgt}, ${r.qty})
      on conflict (hs6, year, reporter, flow, partner) do update set value_usd = excluded.value_usd, net_wgt = excluded.net_wgt, qty = excluded.qty, fetched_at = now()`;
  }
  return rows.length;
}
```

`packages/core/scripts/ingest-comtrade.ts`:

```ts
import { sql } from "../src/db/client";
import { fetchImports, loadImports, sectorSubheadings } from "../src/comtrade/ingest";

const codes = await sectorSubheadings(sql, ["8481", "8413", "7307", "7412"]);
const rows = await fetchImports(codes);
console.log(`imports loaded: ${await loadImports(sql, rows)} of ${codes.length} subheadings; total USD bn ${(rows.reduce((s, r) => s + r.value_usd, 0) / 1e9).toFixed(2)}`);
await sql.end();
```

`packages/core/scripts/ingest-mining.ts`:

```ts
import { sql } from "../src/db/client";
import { TarmeezClient } from "../src/tarmeez/client";

type Mining = { Id: number; CompanyName: { Ar: string; En: string }; Website: string | null; Mobile: string | null; Email: string | null };
const client = new TarmeezClient();
const page = await client.fetchJson<{ TotalCount: number; Items: Mining[] }>("/mining/companies?pageIndex=1&pageSize=200");
for (const m of page.Items) {
  await sql`insert into mining_companies (id, name_ar, name_en, website, email, mobile, raw) values (${m.Id}, ${m.CompanyName?.Ar?.trim() ?? null}, ${m.CompanyName?.En?.trim() ?? null}, ${m.Website?.trim() ?? null}, ${m.Email?.trim() ?? null}, ${m.Mobile?.trim() ?? null}, ${sql.json(m as never)})
    on conflict (id) do update set name_ar = excluded.name_ar, name_en = excluded.name_en, website = excluded.website, email = excluded.email, mobile = excluded.mobile, raw = excluded.raw`;
}
console.log(`mining companies: ${page.Items.length}`);
await sql.end();
```

`packages/core/scripts/seed-mandatory-list.ts` (the announced 2027 tranche, cited to SPA; the full list arrives when a human downloads the PDF):

```ts
import { sql } from "../src/db/client";

const rows = [
  { hs4: "8481", label_en: "Valves", label_ar: "الصمامات", effective_from: "2027-08-01", source_url: "https://www.spa.gov.sa/en/N2514218", note: "Announced tranche subject to a minimum local-content percentage from 1 August 2027" },
  { hs4: "8413", label_en: "Water pumps", label_ar: "مضخات المياه", effective_from: "2027-08-01", source_url: "https://www.spa.gov.sa/en/N2514218", note: "Announced tranche" },
  { hs4: "7408", label_en: "Copper wire", label_ar: "أسلاك النحاس", effective_from: "2027-08-01", source_url: "https://www.spa.gov.sa/en/N2514218", note: "Announced tranche" },
  { hs4: "8415", label_en: "Split air conditioners", label_ar: "مكيفات السبليت", effective_from: "2027-08-01", source_url: "https://www.spa.gov.sa/en/N2514218", note: "Announced tranche" },
  { hs4: "9018", label_en: "Medical devices", label_ar: "الأجهزة الطبية", effective_from: "2027-08-01", source_url: "https://www.spa.gov.sa/en/N2514218", note: "Announced tranche" },
];
for (const r of rows) await sql`insert into mandatory_list ${sql(r)} on conflict (hs4) do update set label_en = excluded.label_en, label_ar = excluded.label_ar, effective_from = excluded.effective_from, source_url = excluded.source_url, note = excluded.note`;
console.log(`mandatory list seeded: ${rows.length} headings`);
await sql.end();
```

Add root scripts: `"ingest:comtrade"`, `"ingest:mining"`, `"seed:mandatory"`.

- [ ] **Step 4: Run the test, then the three scripts**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/comtrade.test.ts && bun run ingest:comtrade && bun run ingest:mining && bun run seed:mandatory`
Expected: PASS; imports loaded for about 30 subheadings with a total near USD 5 billion; 40 mining companies; 5 mandatory headings.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/comtrade packages/core/scripts/ingest-comtrade.ts packages/core/scripts/ingest-mining.ts packages/core/scripts/seed-mandatory-list.ts packages/core/test/comtrade.test.ts package.json
git commit -m "feat(core): Comtrade import values, mining companies and the announced Mandatory List tranche"
```

---

### Task 3: The seeded demand generator

**Files:**
- Create: `packages/core/src/demand/generate.ts`, `packages/core/scripts/generate-demand.ts`
- Test: `packages/core/test/demand-generate.test.ts`

**Interfaces:**
- Produces: `PORTFOLIO_IMPORT_SHARE = 0.12`; `PORTCOS` (name, systems, sectors); `type DemandSeed = { line_key: string; portco: string; source_system: string; raw_text: string; qty: number; qty_unit: string; history_factor: number; seed_hs6: string; annual_value_usd: number }`; `generateDemand(seed: number, imports: { hs6: string; value_usd: number }[], opts?: { lines?: number }): DemandSeed[]` deterministic for a seed, lines spread across the sector subheadings weighted by import value, in six surface formats (Arabic MSA, Arabic with Arabic-Indic digits, English SAP-style abbreviations, English prose, mixed, Excel-style with inconsistent units), with `annual_value_usd` summing per subheading to `import value × PORTFOLIO_IMPORT_SHARE`.

- [ ] **Step 1: Write the failing test**

`packages/core/test/demand-generate.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { generateDemand, PORTFOLIO_IMPORT_SHARE } from "../src/demand/generate";

const imports = [{ hs6: "848180", value_usd: 1_000_000 }, { hs6: "841370", value_usd: 500_000 }, { hs6: "730723", value_usd: 100_000 }];

describe("generateDemand", () => {
  test("is deterministic for a seed and different across seeds", () => {
    const a = generateDemand(7, imports, { lines: 24 });
    const b = generateDemand(7, imports, { lines: 24 });
    const c = generateDemand(8, imports, { lines: 24 });
    expect(a).toEqual(b);
    expect(a.map((l) => l.raw_text)).not.toEqual(c.map((l) => l.raw_text));
    expect(a).toHaveLength(24);
  });
  test("anchors annual values to the import value times the portfolio share, per subheading", () => {
    const lines = generateDemand(1, imports, { lines: 60 });
    for (const imp of imports) {
      const sum = lines.filter((l) => l.seed_hs6 === imp.hs6).reduce((s, l) => s + l.annual_value_usd, 0);
      expect(Math.abs(sum - imp.value_usd * PORTFOLIO_IMPORT_SHARE)).toBeLessThan(1);
    }
  });
  test("uses several surface formats, real portco names and unique keys", () => {
    const lines = generateDemand(3, imports, { lines: 60 });
    expect(new Set(lines.map((l) => l.line_key)).size).toBe(60);
    expect(lines.some((l) => /[؀-ۿ]/.test(l.raw_text))).toBe(true);
    expect(lines.some((l) => /[٠-٩]/.test(l.raw_text))).toBe(true);
    expect(lines.some((l) => /VLV|PMP|FLG|ELB/.test(l.raw_text))).toBe(true);
    expect(lines.every((l) => l.portco.length > 2 && l.qty > 0 && l.history_factor >= 1)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/demand-generate.test.ts`
Expected: FAIL with "Cannot find module '../src/demand/generate'".

- [ ] **Step 3: Implement the generator**

`packages/core/src/demand/generate.ts`:

```ts
export const PORTFOLIO_IMPORT_SHARE = 0.12;

export const PORTCOS: { name: string; systems: string[] }[] = [
  { name: "Ma'aden", systems: ["SAP MM", "SAP Ariba"] },
  { name: "ACWA Power", systems: ["Oracle iProc", "Excel"] },
  { name: "Saudi Electricity Company", systems: ["SAP MM"] },
  { name: "NEOM", systems: ["Oracle Fusion", "Excel"] },
  { name: "SABIC", systems: ["SAP Ariba"] },
  { name: "Marafiq", systems: ["SAP MM", "Excel"] },
  { name: "SIRC", systems: ["Oracle iProc"] },
  { name: "Red Sea Global", systems: ["Oracle Fusion"] },
  { name: "ROSHN", systems: ["Excel", "SAP MM"] },
  { name: "Qiddiya", systems: ["Oracle iProc"] },
  { name: "Bahri", systems: ["SAP MM"] },
  { name: "Saudi Aramco", systems: ["SAP MM", "SAP Ariba"] },
];

export type DemandSeed = { line_key: string; portco: string; source_system: string; raw_text: string; qty: number; qty_unit: string; history_factor: number; seed_hs6: string; annual_value_usd: number };

type Template = { hs6: string; family: "valve" | "pump" | "fitting" | "flange"; forms: ((p: Pick) => string)[]; sizes: string[]; materials: { ar: string; en: string; abbr: string }[]; ratings: string[] };
type Pick = { size: string; sizeDn: string; sizeAr: string; mat: { ar: string; en: string; abbr: string }; rating: string; ratingAr: string };

const DN: Record<string, string> = { "1/2": "DN15", "3/4": "DN20", "1": "DN25", "2": "DN50", "3": "DN80", "4": "DN100", "6": "DN150", "8": "DN200" };
const ARABIC_DIGITS = (s: string) => s.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
const SS = { ar: "ستانلس ستيل", en: "stainless steel", abbr: "SS" }, SS316 = { ar: "ستانلس ستيل 316", en: "stainless steel 316", abbr: "SS316" }, CS = { ar: "كربون ستيل", en: "carbon steel", abbr: "CS" }, CI = { ar: "حديد زهر", en: "cast iron", abbr: "CI" }, DI = { ar: "حديد زهر مطاوع", en: "ductile iron", abbr: "DI" }, BR = { ar: "نحاس", en: "brass", abbr: "BRS" };

const TEMPLATES: Template[] = [
  { hs6: "848180", family: "valve", sizes: ["1/2", "1", "2", "3", "4", "6"], materials: [SS, SS316, CS, CI, DI], ratings: ["PN16", "PN40", "CL150", "CL300"],
    forms: [(p) => `صمام كروي ${p.mat.ar} ${p.sizeAr} بوصة، ضغط ${p.ratingAr}`, (p) => `BALL VLV ${p.size}IN ${p.mat.abbr} ${p.rating} FLGD`, (p) => `Valve, ball, ${p.mat.en}, ${p.size} inch, ${p.rating}`, (p) => `صمام بوابة ${p.mat.ar} ${p.sizeDn} ${p.rating} بشفة`, (p) => `GATE VALVE ${p.size}" ${p.mat.abbr} ${p.rating} FLANGED`, (p) => `Butterfly valve wafer ${p.sizeDn} ${p.mat.en} ${p.rating}`] },
  { hs6: "848130", family: "valve", sizes: ["1", "2", "4", "6"], materials: [SS, CS, BR], ratings: ["PN16", "CL150", "CL300"],
    forms: [(p) => `صمام عدم رجوع ${p.mat.ar} ${p.sizeAr} بوصة`, (p) => `CHK VLV SWING ${p.size}IN ${p.mat.abbr} ${p.rating}`, (p) => `Check valve, ${p.mat.en}, ${p.sizeDn}, ${p.rating}`] },
  { hs6: "848140", family: "valve", sizes: ["1/2", "1", "2"], materials: [SS, BR, CS], ratings: ["10 bar", "16 bar", "40 bar"],
    forms: [(p) => `صمام أمان ${p.mat.ar} ${p.sizeAr} بوصة ضغط ${p.ratingAr}`, (p) => `SAFETY RELIEF VLV ${p.size}IN ${p.mat.abbr} SET ${p.rating}`, (p) => `Pressure relief valve ${p.size} inch ${p.mat.en} ${p.rating}`] },
  { hs6: "841370", family: "pump", sizes: ["25", "50", "100", "200"], materials: [CI, SS, DI], ratings: ["20 m", "40 m", "60 m"],
    forms: [(p) => `مضخة طرد مركزي أفقية ${p.sizeAr} م3/س رفع ${p.ratingAr} ${p.mat.ar}`, (p) => `PUMP CENTRIFUGAL END SUCTION ${p.size}M3/HR ${p.rating.replace(" ", "")} HEAD ${p.mat.abbr}`, (p) => `Centrifugal pump ${p.size} m3/h, ${p.rating} head, ${p.mat.en} casing`] },
  { hs6: "841350", family: "pump", sizes: ["5", "20", "50"], materials: [SS, { ar: "بي في دي إف", en: "PVDF", abbr: "PVDF" }], ratings: ["10 bar", "16 bar"],
    forms: [(p) => `مضخة جرعات ديافرام ${p.sizeAr} لتر/ساعة ${p.ratingAr} ${p.mat.ar}`, (p) => `DOSING PMP DIAPHRAGM ${p.size}L/H ${p.rating} ${p.mat.abbr} HEAD`, (p) => `Diaphragm dosing pump ${p.size} l/h ${p.rating} ${p.mat.en}`] },
  { hs6: "730723", family: "fitting", sizes: ["1", "2", "3", "4", "6"], materials: [SS316, SS], ratings: ["SCH10", "SCH40"],
    forms: [(p) => `كوع 90 درجة ${p.mat.ar} قطر ${p.sizeAr} بوصة لحام تناكبي ${p.rating}`, (p) => `ELB 90 LR ${p.size}" ${p.rating} ${p.mat.abbr} BW`, (p) => `Butt weld elbow 90 degree ${p.size} inch ${p.rating} ${p.mat.en}`] },
  { hs6: "730793", family: "fitting", sizes: ["2", "4", "6", "8"], materials: [CS], ratings: ["SCH40", "SCH80"],
    forms: [(p) => `تي متساوي ${p.mat.ar} ${p.sizeAr} بوصة ${p.rating} لحام`, (p) => `TEE EQUAL ${p.size}" ${p.rating} ${p.mat.abbr} BW A234`, (p) => `Butt weld equal tee ${p.size} inch ${p.rating} carbon steel`] },
  { hs6: "730791", family: "flange", sizes: ["2", "4", "6", "8"], materials: [CS], ratings: ["CL150", "CL300", "PN16"],
    forms: [(p) => `شفة عمياء ${p.mat.ar} ${p.sizeAr} بوصة كلاس ${p.ratingAr} RF`, (p) => `FLG WN ${p.size}" ${p.rating} RF ${p.mat.abbr} A105`, (p) => `Weld neck flange ${p.size} inch ${p.rating} raised face carbon steel`] },
  { hs6: "730721", family: "flange", sizes: ["2", "4", "6"], materials: [SS316, SS], ratings: ["CL150", "CL300"],
    forms: [(p) => `فلنجة ${p.mat.ar} عنق لحام ${p.sizeAr} بوصة ${p.ratingAr}`, (p) => `FLG WN ${p.size}" ${p.rating} ${p.mat.abbr} RF`, (p) => `Stainless weld neck flange ${p.size} inch ${p.rating}`] },
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = <T>(rnd: () => number, xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;

export function generateDemand(seed: number, imports: { hs6: string; value_usd: number }[], opts: { lines?: number } = {}): DemandSeed[] {
  const rnd = mulberry32(seed);
  const total = opts.lines ?? 96;
  const templates = TEMPLATES.filter((t) => imports.some((i) => i.hs6 === t.hs6));
  const weights = templates.map((t) => Math.sqrt(imports.find((i) => i.hs6 === t.hs6)!.value_usd));
  const wsum = weights.reduce((s, w) => s + w, 0);
  const counts = templates.map((_, i) => Math.max(2, Math.round((weights[i]! / wsum) * total)));
  while (counts.reduce((s, c) => s + c, 0) > total) { const i = counts.indexOf(Math.max(...counts)); counts[i]!--; }
  while (counts.reduce((s, c) => s + c, 0) < total) { const i = counts.indexOf(Math.min(...counts)); counts[i]!++; }
  const out: DemandSeed[] = [];
  templates.forEach((t, ti) => {
    const n = counts[ti]!;
    const shares = Array.from({ length: n }, () => 0.5 + rnd());
    const ssum = shares.reduce((s, x) => s + x, 0);
    const budget = imports.find((i) => i.hs6 === t.hs6)!.value_usd * PORTFOLIO_IMPORT_SHARE;
    for (let k = 0; k < n; k++) {
      const portco = pick(rnd, PORTCOS);
      const size = pick(rnd, t.sizes), mat = pick(rnd, t.materials), rating = pick(rnd, t.ratings);
      const p: Pick = { size, sizeDn: DN[size] ?? `DN${size}`, sizeAr: ARABIC_DIGITS(size), mat, rating, ratingAr: ARABIC_DIGITS(rating.replace(/^(PN|CL)/, "$1 ")) };
      const form = pick(rnd, t.forms);
      const qty = Math.max(1, Math.round((rnd() ** 2) * (t.family === "pump" ? 12 : 200)));
      const history_factor = Number((6 + rnd() * 60).toFixed(1));
      out.push({
        line_key: `${seed}:${t.hs6}:${k}`,
        portco: portco.name, source_system: pick(rnd, portco.systems),
        raw_text: form(p), qty, qty_unit: t.family === "pump" ? "units" : "pcs", history_factor,
        seed_hs6: t.hs6, annual_value_usd: Number(((shares[k]! / ssum) * budget).toFixed(2)),
      });
    }
  });
  return out;
}
```

`packages/core/scripts/generate-demand.ts`:

```ts
import { sql } from "../src/db/client";
import { generateDemand } from "../src/demand/generate";

const seed = Number(process.argv[2] ?? "2026");
const lines = Number(process.argv[3] ?? "96");
const imports = await sql<{ hs6: string; value_usd: number }[]>`select hs6, value_usd::float as value_usd from imports where year = 2024`;
const rows = generateDemand(seed, imports, { lines });
let inserted = 0;
for (const r of rows) {
  const [row] = await sql<{ inserted: boolean }[]>`
    insert into demand_lines (raw_text, portco, source_system, qty, qty_unit, history_factor, annual_value_usd, seed_hs6, simulated, line_key)
    values (${r.raw_text}, ${r.portco}, ${r.source_system}, ${r.qty}, ${r.qty_unit}, ${r.history_factor}, ${r.annual_value_usd}, ${r.seed_hs6}, true, ${r.line_key})
    on conflict (line_key) do nothing returning true as inserted`;
  if (row?.inserted) inserted++;
}
console.log(`demand lines generated: ${rows.length}, inserted: ${inserted}, annual value USD ${(rows.reduce((s, r) => s + r.annual_value_usd, 0) / 1e6).toFixed(1)} M`);
await sql.end();
```

Add root script `"demand:generate"`.

- [ ] **Step 4: Run the test, then generate**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/demand-generate.test.ts && bun run demand:generate 2026 96`
Expected: PASS, three tests; 96 lines inserted with an annual value in the hundreds of millions of USD.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/demand/generate.ts packages/core/scripts/generate-demand.ts packages/core/test/demand-generate.test.ts package.json
git commit -m "feat(core): seeded, messy, Comtrade-anchored demand set with real portfolio names"
```

---

### Task 4: Resolve and pool

**Files:**
- Create: `packages/core/src/demand/pool.ts`, `packages/core/scripts/resolve-demand.ts`
- Modify: `packages/core/src/coordinator/run.ts` (accept an existing demand line id)
- Test: `packages/core/test/demand-pool.test.ts`

**Interfaces:**
- Produces: `runCoordinator(db, input & { demandLineId?: string })` updates the existing row instead of inserting when `demandLineId` is given; `poolAndPersist(db): Promise<{ orders: number; lines: number }>` groups resolved lines (`hs6 not null`) with `poolLines`, writes `pooled_orders` (hs6, family from the envelope, title from the envelope, spec_envelope, qty_now = Σ qty, qty_annual = Σ qty × history_factor, annual_value_usd = Σ annual_value_usd, portco_count, qty_unit) and sets `demand_lines.pooled_order_id`; existing pooled orders are replaced.

- [ ] **Step 1: Write the failing test**

`packages/core/test/demand-pool.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { poolAndPersist } from "../src/demand/pool";

const spec = (over: Record<string, unknown>) => JSON.stringify({ object_class: "ball valve", object_family: "valve", size_inch: 2, size_dn: 50, pressure_bar: 40, pressure_class: null, material: "stainless_steel", material_grade: null, connection: null, standard: null, quantity: null, quantity_unit: null, extra_attrs: [], english_description: "2 inch ss ball valve", source_language: "en", ...over });

describe.skipIf(!process.env.DATABASE_URL)("poolAndPersist", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from demand_lines where line_key like 'test:pool:%'`;
    await sql`insert into demand_lines (raw_text, portco, hs6, normalized_spec, qty, history_factor, annual_value_usd, line_key, seed_hs6) values
      ('a', 'Ma''aden', '848180', ${spec({})}::jsonb, 12, 10, 1000, 'test:pool:1', '848180'),
      ('b', 'ACWA Power', '848180', ${spec({ material_grade: "316" })}::jsonb, 40, 5, 2000, 'test:pool:2', '848180'),
      ('c', 'SEC', '848180', ${spec({ object_class: "gate valve" })}::jsonb, 5, 1, 300, 'test:pool:3', '848180'),
      ('d', 'NEOM', null, null, 1, 1, 10, 'test:pool:4', '848180')`;
  });
  test("pools compatible resolved lines into orders with quantities and values, leaving unresolved lines alone", async () => {
    const r = await poolAndPersist(sql);
    expect(r.lines).toBeGreaterThanOrEqual(3);
    const orders = await sql<{ hs6: string; qty_now: number; qty_annual: number; annual_value_usd: number; portco_count: number; title: string }[]>`
      select o.hs6, o.qty_now::float as qty_now, o.qty_annual::float as qty_annual, o.annual_value_usd::float as annual_value_usd, o.portco_count, o.title
      from pooled_orders o where o.id in (select pooled_order_id from demand_lines where line_key like 'test:pool:%') order by qty_now desc`;
    expect(orders.length).toBe(2);
    expect(orders[0]).toMatchObject({ hs6: "848180", qty_now: 52, qty_annual: 320, annual_value_usd: 3000, portco_count: 2 });
    expect(orders[0]!.title).toContain("ball valve");
    const [unresolved] = await sql<{ pooled_order_id: string | null }[]>`select pooled_order_id from demand_lines where line_key = 'test:pool:4'`;
    expect(unresolved!.pooled_order_id).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/demand-pool.test.ts`
Expected: FAIL with "Cannot find module '../src/demand/pool'".

- [ ] **Step 3: Implement pooling and the resolve script; extend the Coordinator**

`packages/core/src/demand/pool.ts`:

```ts
import type { Sql } from "postgres";
import { poolLines } from "../coordinator/pool";
import type { NormalizedSpecT } from "../coordinator/schema";

export function envelopeTitle(env: { object_class: string; size_inch: number | null; material: string | null; material_grade: string | null; pressure_bar: number | null; pressure_class: string | null }): string {
  const parts = [env.material ? env.material.replace(/_/g, " ") + (env.material_grade ? ` ${env.material_grade}` : "") : null, env.object_class, env.size_inch !== null ? `${env.size_inch} inch` : null, env.pressure_bar !== null ? `${env.pressure_bar} bar` : env.pressure_class ? `class ${env.pressure_class}` : null];
  return parts.filter(Boolean).join(" ");
}

export async function poolAndPersist(db: Sql): Promise<{ orders: number; lines: number }> {
  const lines = await db<{ id: string; portco: string; hs6: string; normalized_spec: NormalizedSpecT; qty: number | null; qty_unit: string | null; history_factor: number; annual_value_usd: number | null }[]>`
    select id, portco, hs6, normalized_spec, qty::float as qty, qty_unit, history_factor::float as history_factor, annual_value_usd::float as annual_value_usd
    from demand_lines where hs6 is not null and normalized_spec is not null and simulated`;
  const pooled = poolLines(lines.map((l) => ({ id: l.id, portco: l.portco, hs6: l.hs6, spec: l.normalized_spec, quantity: l.qty })));
  let orders = 0;
  await db.begin(async (tx) => {
    await tx`update demand_lines set pooled_order_id = null where simulated`;
    await tx`delete from pooled_orders where id not in (select pooled_order_id from demand_lines where pooled_order_id is not null)`;
    for (const o of pooled) {
      const members = lines.filter((l) => o.lineIds.includes(l.id));
      const qtyAnnual = members.reduce((s, l) => s + (l.qty ?? 0) * (l.history_factor || 1), 0);
      const value = members.reduce((s, l) => s + (l.annual_value_usd ?? 0), 0);
      const [row] = await tx<{ id: string }[]>`
        insert into pooled_orders (hs6, spec_envelope, family, title, qty_now, qty_annual, annual_value_usd, portco_count, qty_unit)
        values (${o.hs6}, ${tx.json(o.envelope as never)}, ${o.envelope.object_family}, ${envelopeTitle(o.envelope)}, ${o.qty_now}, ${qtyAnnual}, ${value}, ${o.portcos.length}, ${members[0]?.qty_unit ?? null})
        returning id`;
      await tx`update demand_lines set pooled_order_id = ${row!.id} where id = any(${o.lineIds})`;
      orders++;
    }
  });
  return { orders, lines: lines.length };
}
```

In `packages/core/src/coordinator/run.ts`, change `CoordinatorInput` to `{ rawText: string; portco: string; sourceSystem?: string; demandLineId?: string }` and replace the insert with:

```ts
    let demandLineId = input.demandLineId;
    if (demandLineId) {
      await db`update demand_lines set language = ${normalized.source_language}, normalized_spec = ${db.json(normalized as never)}, hs6 = ${out.hs6!}, confidence = ${out.confidence!}, run_id = ${runId} where id = ${demandLineId}`;
    } else {
      const [line] = await db<{ id: string }[]>`
        insert into demand_lines (raw_text, portco, source_system, language, normalized_spec, hs6, confidence, run_id, simulated)
        values (${input.rawText}, ${input.portco}, ${input.sourceSystem ?? null}, ${normalized.source_language}, ${db.json(normalized as never)}, ${out.hs6!}, ${out.confidence!}, ${runId}, false)
        returning id`;
      demandLineId = line!.id;
    }
    return { runId, demandLineId, normalized, candidates: out.candidates!, hs6: out.hs6!, confidence: out.confidence!, reasoning: out.reasoning! };
```

`packages/core/scripts/resolve-demand.ts`:

```ts
import { sql } from "../src/db/client";
import { runCoordinator } from "../src/coordinator/run";
import { poolAndPersist } from "../src/demand/pool";

const limit = Number(process.argv[2] ?? "1000");
const pending = await sql<{ id: string; raw_text: string; portco: string; source_system: string | null }[]>`
  select id, raw_text, portco, source_system from demand_lines where simulated and hs6 is null order by created_at limit ${limit}`;
console.log(`unresolved demand lines: ${pending.length}`);
let done = 0, failed = 0;
const started = Date.now();
for (const line of pending) {
  try { const r = await runCoordinator(sql, { rawText: line.raw_text, portco: line.portco, sourceSystem: line.source_system ?? undefined, demandLineId: line.id }); done++; console.log(`[${done}/${pending.length}] ${r.hs6} ${line.raw_text.slice(0, 50)}`); }
  catch (err) { failed++; console.error(`${line.id} failed: ${(err as Error).message}`); }
}
console.log(`resolved ${done}, failed ${failed}, ${((Date.now() - started) / 60000).toFixed(1)} min`);
console.log("pooled:", await poolAndPersist(sql));
await sql.end();
```

Add root script `"demand:resolve"`.

- [ ] **Step 4: Run the tests, then start resolution detached**

Run: `perl -e 'alarm 120; exec @ARGV' bun test packages/core/test/demand-pool.test.ts packages/core/test/coordinator.test.ts`
Expected: PASS.

Then `nohup bun run demand:resolve > <scratch>/resolve.log 2>&1 &` and keep building; 96 lines take about ninety minutes on the local model.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/demand/pool.ts packages/core/scripts/resolve-demand.ts packages/core/src/coordinator/run.ts packages/core/test/demand-pool.test.ts package.json
git commit -m "feat(core): resolve the demand set with the Coordinator and persist pooled orders"
```

---

### Task 5: Matching, split fulfilment and coverage

**Files:**
- Create: `packages/core/src/match/score.ts`, `packages/core/src/match/persist.ts`, `packages/core/src/match/coverage.ts`, `packages/core/scripts/match.ts`, `packages/core/scripts/coverage.ts`
- Test: `packages/core/test/match.test.ts`

**Interfaces:**
- Produces: `type CapabilityCandidate = { id: string; supplier_id: string; hs6: string; class: string; verdict: string; confidence: number | null; best_tier: number | null; spec_attrs: Record<string, string>; declared_amount: number | null; declared_unit: string | null; region_en: string | null; in_made_in_saudi: boolean }`; `specCompatible(envelope: Envelope, attrs: Record<string, string>): { ok: boolean; hits: string[]; conflicts: string[] }`; `scoreCapability(order: { hs6: string; envelope: Envelope }, cap: CapabilityCandidate): { score: number; reasons: Record<string, number | string> }` with class weights manufacturer 1.0, assembler 0.9, authorised_distributor 0.6, trader 0.4; verdict weights supported 1.0, pending 0.5, refuted 0; tier factor 1: 1.0, 2: 0.85, 3: 0.6, none 0.4; a spec conflict multiplies by 0.3; `isSupported(cap)`; `splitShares(order: { qty_annual: number | null }, ranked: CapabilityCandidate[]): number[]` allocating by declared capacity when units match, else equal shares over the top three; `matchOrder(db, orderId)`, `matchAll(db)`; `coverage(db): Promise<{ spend_total: number; spend_covered: number; coverage: number; line_total: number; line_covered: number; line_coverage: number; manufacturing_gaps: number; supply_gaps: number }>`.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/match.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { isSupported, scoreCapability, specCompatible, splitShares, type CapabilityCandidate } from "../src/match/score";
import { matchOrder } from "../src/match/persist";
import { coverage } from "../src/match/coverage";

const env = { object_class: "ball valve", object_family: "valve", size_inch: 2, size_dn: 50, pressure_bar: 40, pressure_class: null, material: "stainless_steel", material_grade: "316", connection: null };
const cap = (over: Partial<CapabilityCandidate>): CapabilityCandidate => ({ id: "c", supplier_id: "s", hs6: "848180", class: "manufacturer", verdict: "supported", confidence: 0.8, best_tier: 2, spec_attrs: {}, declared_amount: null, declared_unit: null, region_en: null, in_made_in_saudi: false, ...over });

describe("scoring", () => {
  test("specCompatible reads stated attributes against the envelope", () => {
    expect(specCompatible(env, { material: "stainless steel 316", size: "1/2 to 4 inch" }).ok).toBe(true);
    expect(specCompatible(env, { material: "cast iron" }).conflicts).toContain("material");
    expect(specCompatible(env, {}).ok).toBe(true);
  });
  test("class, verdict and tier weights order candidates as the glossary says", () => {
    const maker = scoreCapability({ hs6: "848180", envelope: env }, cap({})).score;
    const trader = scoreCapability({ hs6: "848180", envelope: env }, cap({ class: "trader" })).score;
    const pending = scoreCapability({ hs6: "848180", envelope: env }, cap({ verdict: "pending" })).score;
    const refuted = scoreCapability({ hs6: "848180", envelope: env }, cap({ verdict: "refuted" })).score;
    const tier1 = scoreCapability({ hs6: "848180", envelope: env }, cap({ best_tier: 1 })).score;
    expect(maker).toBeGreaterThan(trader);
    expect(maker).toBeGreaterThan(pending);
    expect(refuted).toBe(0);
    expect(tier1).toBeGreaterThan(maker);
  });
  test("isSupported requires a supported verdict and tier 1 or 2 evidence", () => {
    expect(isSupported(cap({}))).toBe(true);
    expect(isSupported(cap({ best_tier: 3 }))).toBe(false);
    expect(isSupported(cap({ verdict: "pending" }))).toBe(false);
  });
  test("splitShares allocates by declared capacity when units are comparable, else equally over the top three", () => {
    expect(splitShares({ qty_annual: 1000 }, [cap({ declared_amount: 600, declared_unit: "Piece" }), cap({ declared_amount: 400, declared_unit: "Piece" })])).toEqual([0.6, 0.4]);
    expect(splitShares({ qty_annual: 1000 }, [cap({}), cap({}), cap({}), cap({})])).toEqual([1 / 3, 1 / 3, 1 / 3, 0]);
  });
});

describe.skipIf(!process.env.DATABASE_URL)("matchOrder and coverage", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from suppliers where id like 'test:mt%'`;
    await sql`delete from pooled_orders where title like 'test match%'`;
    await sql`insert into suppliers (id, name_en, source, region_en) values ('test:mt1', 'Maker', 'test', 'Eastern Region'), ('test:mt2', 'Trader', 'test', 'Riyadh Region')`;
    await sql`insert into capabilities (supplier_id, hs6, product_title, class, verdict, confidence, origin) values ('test:mt1', '848180', 'ball valves', 'manufacturer', 'supported', 0.8, 'detective'), ('test:mt2', '848180', 'ball valves', 'trader', 'supported', 0.7, 'detective'), ('test:mt2', '841370', 'pumps', 'trader', 'refuted', 0.1, 'detective')`;
    const caps = await sql<{ id: string; supplier_id: string; hs6: string }[]>`select id, supplier_id, hs6 from capabilities where supplier_id like 'test:mt%'`;
    for (const c of caps) await sql`insert into evidence (capability_id, tier, source_type, source_url, excerpt) values (${c.id}, ${c.supplier_id === 'test:mt1' ? 2 : 3}, 'test', 'https://x', 'x')`;
  });
  test("ranks the maker first and computes coverage over the test orders", async () => {
    const [o1] = await sql<{ id: string }[]>`insert into pooled_orders (hs6, spec_envelope, family, title, annual_value_usd) values ('848180', ${sql.json(env as never)}, 'valve', 'test match valve', 700) returning id`;
    const [o2] = await sql<{ id: string }[]>`insert into pooled_orders (hs6, spec_envelope, family, title, annual_value_usd) values ('841370', ${sql.json({ ...env, object_class: "centrifugal pump", object_family: "pump" } as never)}, 'pump', 'test match pump', 300) returning id`;
    const r = await matchOrder(sql, o1!.id);
    expect(r.matches).toBe(2);
    const rows = await sql<{ supplier_id: string; rank: number }[]>`select c.supplier_id, m.rank from matches m join capabilities c on c.id = m.capability_id where m.pooled_order_id = ${o1!.id} order by m.rank`;
    expect(rows.map((x) => x.supplier_id)).toEqual(["test:mt1", "test:mt2"]);
    await matchOrder(sql, o2!.id);
    const c = await coverage(sql, { onlyOrderIds: [o1!.id, o2!.id] });
    expect(c.spend_total).toBe(1000);
    expect(c.spend_covered).toBe(700);
    expect(c.coverage).toBeCloseTo(0.7, 5);
    expect(c.line_coverage).toBeCloseTo(0.5, 5);
    expect(c.supply_gaps).toBe(1);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/match.test.ts`
Expected: FAIL with "Cannot find module '../src/match/score'".

- [ ] **Step 3: Implement scoring, persistence and coverage**

`packages/core/src/match/score.ts`:

```ts
import type { Envelope } from "../coordinator/pool";
import { canonMaterial, parseSizeToken } from "../coordinator/units";

export type CapabilityCandidate = { id: string; supplier_id: string; hs6: string; class: string; verdict: string; confidence: number | null; best_tier: number | null; spec_attrs: Record<string, string>; declared_amount: number | null; declared_unit: string | null; region_en: string | null; in_made_in_saudi: boolean };

const CLASS_W: Record<string, number> = { manufacturer: 1, assembler: 0.9, authorised_distributor: 0.6, trader: 0.4 };
const VERDICT_W: Record<string, number> = { supported: 1, pending: 0.5, refuted: 0 };
const TIER_W: Record<number, number> = { 1: 1, 2: 0.85, 3: 0.6, 4: 0.4 };

export function specCompatible(env: Envelope, attrs: Record<string, string>): { ok: boolean; hits: string[]; conflicts: string[] } {
  const hits: string[] = [], conflicts: string[] = [];
  const text = Object.entries(attrs).map(([k, v]) => `${k} ${v}`).join(" ");
  if (env.material) {
    const stated = Object.entries(attrs).filter(([k]) => /material|body|grade/i.test(k)).map(([, v]) => canonMaterial(v)).filter(Boolean);
    if (stated.length) (stated.includes(env.material) ? hits : conflicts).push("material");
  }
  if (env.size_inch !== null) {
    const range = text.match(/(\d+(?:\/\d+)?)\s*(?:to|-|–)\s*(\d+(?:\/\d+)?)\s*(?:inch|in|")/i);
    if (range) {
      const lo = parseSizeToken(`${range[1]}"`)?.inch ?? null, hi = parseSizeToken(`${range[2]}"`)?.inch ?? null;
      if (lo !== null && hi !== null) (env.size_inch >= lo && env.size_inch <= hi ? hits : conflicts).push("size");
    }
  }
  return { ok: conflicts.length === 0, hits, conflicts };
}

export function isSupported(cap: CapabilityCandidate): boolean {
  return cap.verdict === "supported" && cap.best_tier !== null && cap.best_tier <= 2;
}

export function scoreCapability(order: { hs6: string; envelope: Envelope }, cap: CapabilityCandidate): { score: number; reasons: Record<string, number | string> } {
  const cls = CLASS_W[cap.class] ?? 0.4;
  const verdict = VERDICT_W[cap.verdict] ?? 0.5;
  const tier = cap.best_tier ? TIER_W[cap.best_tier] ?? 0.4 : 0.4;
  const spec = specCompatible(order.envelope, cap.spec_attrs ?? {});
  const specW = spec.ok ? 1 + 0.1 * spec.hits.length : 0.3;
  const hs = cap.hs6 === order.hs6 ? 1 : cap.hs6.slice(0, 4) === order.hs6.slice(0, 4) ? 0.7 : 0.2;
  const conf = cap.confidence ?? 0.5;
  const mis = cap.in_made_in_saudi ? 1.05 : 1;
  const score = Number((cls * verdict * tier * specW * hs * (0.5 + 0.5 * conf) * mis).toFixed(4));
  return { score, reasons: { class: cap.class, verdict: cap.verdict, tier: cap.best_tier ?? "none", spec: spec.ok ? `ok (${spec.hits.join(",") || "no stated attributes"})` : `conflict (${spec.conflicts.join(",")})`, hs: hs === 1 ? "exact" : hs === 0.7 ? "heading" : "other" } };
}

export function splitShares(order: { qty_annual: number | null }, ranked: CapabilityCandidate[]): number[] {
  const top = ranked.slice(0, 3);
  const caps = top.map((c) => (c.declared_amount && c.declared_unit && /piece|unit|pcs|عدد|قطعة/i.test(c.declared_unit) ? c.declared_amount : null));
  const shares = ranked.map(() => 0);
  if (top.length && caps.every((c) => c !== null)) {
    const total = caps.reduce((s, c) => s + (c ?? 0), 0);
    top.forEach((_, i) => { shares[i] = Number(((caps[i] ?? 0) / total).toFixed(4)); });
  } else {
    top.forEach((_, i) => { shares[i] = 1 / top.length; });
  }
  return shares;
}
```

`packages/core/src/match/persist.ts`:

```ts
import type { Sql } from "postgres";
import type { Envelope } from "../coordinator/pool";
import { isSupported, scoreCapability, splitShares, type CapabilityCandidate } from "./score";

export async function candidatesFor(db: Sql, hs6: string): Promise<CapabilityCandidate[]> {
  const heading = hs6.slice(0, 4) + "%";
  return db<CapabilityCandidate[]>`
    select c.id, c.supplier_id, c.hs6, c.class, c.verdict, c.confidence::float as confidence, e.best_tier, c.spec_attrs, c.declared_amount::float as declared_amount, c.declared_unit, s.region_en, s.in_made_in_saudi
    from capabilities c join suppliers s on s.id = c.supplier_id
    left join (select capability_id, min(tier)::int as best_tier from evidence group by capability_id) e on e.capability_id = c.id
    where c.hs6 like ${heading} and c.verdict <> 'refuted'`;
}

export async function matchOrder(db: Sql, orderId: string): Promise<{ matches: number; supported: number; gap_kind: "covered" | "manufacturing_gap" | "supply_gap" }> {
  const [order] = await db<{ id: string; hs6: string; spec_envelope: Envelope; qty_annual: number | null }[]>`select id, hs6, spec_envelope, qty_annual::float as qty_annual from pooled_orders where id = ${orderId}`;
  if (!order) throw new Error(`pooled order ${orderId} not found`);
  const cands = await candidatesFor(db, order.hs6);
  const scored = cands.map((c) => ({ cap: c, ...scoreCapability({ hs6: order.hs6, envelope: order.spec_envelope }, c) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 12);
  const shares = splitShares(order, scored.map((x) => x.cap));
  const supported = scored.filter((x) => isSupported(x.cap));
  const makers = supported.filter((x) => x.cap.class === "manufacturer" || x.cap.class === "assembler");
  const gap_kind = makers.length ? "covered" : supported.length ? "manufacturing_gap" : "supply_gap";
  const [mandatory] = await db<{ n: number }[]>`select count(*)::int as n from mandatory_list where hs4 = ${order.hs6.slice(0, 4)}`;
  await db.begin(async (tx) => {
    await tx`delete from matches where pooled_order_id = ${orderId}`;
    for (let i = 0; i < scored.length; i++) {
      const x = scored[i]!;
      await tx`insert into matches (pooled_order_id, capability_id, score, share, rank, reasons) values (${orderId}, ${x.cap.id}, ${x.score}, ${shares[i] ?? 0}, ${i + 1}, ${tx.json(x.reasons as never)})`;
    }
    await tx`update pooled_orders set gap_kind = ${gap_kind}, mandatory = ${(mandatory?.n ?? 0) > 0}, updated_at = now() where id = ${orderId}`;
  });
  return { matches: scored.length, supported: supported.length, gap_kind };
}

export async function matchAll(db: Sql): Promise<{ orders: number; covered: number; manufacturing_gaps: number; supply_gaps: number }> {
  const orders = await db<{ id: string }[]>`select id from pooled_orders`;
  const tally = { orders: 0, covered: 0, manufacturing_gaps: 0, supply_gaps: 0 };
  for (const o of orders) {
    const r = await matchOrder(db, o.id);
    tally.orders++;
    if (r.gap_kind === "covered") tally.covered++; else if (r.gap_kind === "manufacturing_gap") tally.manufacturing_gaps++; else tally.supply_gaps++;
  }
  return tally;
}
```

`packages/core/src/match/coverage.ts`:

```ts
import type { Sql } from "postgres";

export async function coverage(db: Sql, opts: { onlyOrderIds?: string[] } = {}) {
  const filter = opts.onlyOrderIds ? db`where id = any(${opts.onlyOrderIds})` : db`where true`;
  const [r] = await db<{ spend_total: number; spend_covered: number; line_total: number; line_covered: number; manufacturing_gaps: number; supply_gaps: number }[]>`
    select coalesce(sum(annual_value_usd), 0)::float as spend_total,
           coalesce(sum(annual_value_usd) filter (where gap_kind in ('covered', 'manufacturing_gap')), 0)::float as spend_covered,
           count(*)::int as line_total,
           count(*) filter (where gap_kind in ('covered', 'manufacturing_gap'))::int as line_covered,
           count(*) filter (where gap_kind = 'manufacturing_gap')::int as manufacturing_gaps,
           count(*) filter (where gap_kind = 'supply_gap')::int as supply_gaps
    from pooled_orders ${filter}`;
  const row = r!;
  return { ...row, coverage: row.spend_total ? row.spend_covered / row.spend_total : 0, line_coverage: row.line_total ? row.line_covered / row.line_total : 0 };
}
```

Coverage counts a pooled order as covered by local supply when any supported capability exists, of any class, which is the glossary's definition of coverage; the manufacturing gap is reported separately.

`packages/core/scripts/match.ts`:

```ts
import { sql } from "../src/db/client";
import { matchAll } from "../src/match/persist";
console.log(await matchAll(sql));
await sql.end();
```

`packages/core/scripts/coverage.ts`:

```ts
import { sql } from "../src/db/client";
import { coverage } from "../src/match/coverage";
const c = await coverage(sql);
console.log(`coverage (spend): ${(c.coverage * 100).toFixed(1)}% of USD ${(c.spend_total / 1e6).toFixed(1)}M | line coverage: ${(c.line_coverage * 100).toFixed(1)}% of ${c.line_total} pooled orders | manufacturing gaps: ${c.manufacturing_gaps} | supply gaps: ${c.supply_gaps}`);
const [d] = await sql<{ discovered: number; supported_discovered: number }[]>`select (select count(*) from suppliers where source in ('hunt', 'made_in_saudi', 'mlcp') and not in_tarmeez)::int as discovered, (select count(distinct c.supplier_id) from capabilities c join suppliers s on s.id = c.supplier_id where s.source in ('hunt','made_in_saudi','mlcp') and not s.in_tarmeez and c.verdict = 'supported')::int as supported_discovered`;
console.log(`discovery lift: ${d!.supported_discovered} supported suppliers outside Tarmeez (${d!.discovered} candidates)`);
await sql.end();
```

Add root scripts `"match"` and `"coverage"`.

- [ ] **Step 4: Run the tests, then match everything that is pooled so far**

Run: `perl -e 'alarm 120; exec @ARGV' bun test packages/core/test/match.test.ts && bun run match && bun run coverage`
Expected: PASS, five tests; a tally over the pooled orders; the coverage line.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/match packages/core/scripts/match.ts packages/core/scripts/coverage.ts packages/core/test/match.test.ts package.json
git commit -m "feat(core): matching with class, verdict, tier and spec weights, split fulfilment, coverage and gap kinds"
```

---

### Task 6: LC signals and the input-gated G1 score

**Files:**
- Create: `packages/core/src/lcgpa/g1.ts`, `packages/core/src/lcgpa/signals.ts`
- Test: `packages/core/test/lcgpa.test.ts`

**Interfaces:**
- Produces: `type G1Inputs = { saudi_salaries: number; local_goods_services: number; local_assets_depreciation: number; capability_building: number; total_costs: number }`; `g1Score(inputs: Partial<G1Inputs>): { score: number; template: "G1 Baseline N.1"; components: Record<string, number> } | null` returning null when any input is missing or total is zero; `lcSignals(db, capabilityId): Promise<{ class: string; made_in_saudi: boolean; mandatory: boolean; cr_present: boolean; in_registries: string[]; g1: null }>`.

- [ ] **Step 1: Write the failing test**

`packages/core/test/lcgpa.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { g1Score } from "../src/lcgpa/g1";

describe("g1Score", () => {
  test("computes the entity-level share of local value over total costs", () => {
    const r = g1Score({ saudi_salaries: 30, local_goods_services: 40, local_assets_depreciation: 10, capability_building: 5, total_costs: 200 });
    expect(r).not.toBeNull();
    expect(r!.score).toBeCloseTo(0.425, 6);
    expect(r!.template).toBe("G1 Baseline N.1");
    expect(r!.components).toEqual({ saudi_salaries: 0.15, local_goods_services: 0.2, local_assets_depreciation: 0.05, capability_building: 0.025 });
  });
  test("is input-gated: any missing input or zero total gives null", () => {
    expect(g1Score({ saudi_salaries: 30, total_costs: 200 })).toBeNull();
    expect(g1Score({ saudi_salaries: 30, local_goods_services: 40, local_assets_depreciation: 10, capability_building: 5, total_costs: 0 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/lcgpa.test.ts`
Expected: FAIL with "Cannot find module '../src/lcgpa/g1'".

- [ ] **Step 3: Implement**

`packages/core/src/lcgpa/g1.ts`:

```ts
/**
 * LCGPA Local Content Score Template, Baseline (Template No. N.1), guideline G1 version 5.0 (15 November 2022).
 * The entity-level score is the share of an entity's total costs that stayed in the Kingdom in the last fiscal year:
 * Saudi employee compensation, goods and services bought from local suppliers, depreciation of locally sourced assets,
 * and capability-building spend (training, R&D, supplier development). This function computes exactly that ratio from
 * declared inputs and refuses to guess: any missing input yields null.
 */
export type G1Inputs = { saudi_salaries: number; local_goods_services: number; local_assets_depreciation: number; capability_building: number; total_costs: number };
const KEYS: (keyof G1Inputs)[] = ["saudi_salaries", "local_goods_services", "local_assets_depreciation", "capability_building", "total_costs"];

export function g1Score(inputs: Partial<G1Inputs>): { score: number; template: "G1 Baseline N.1"; components: Record<string, number> } | null {
  for (const k of KEYS) if (typeof inputs[k] !== "number" || !Number.isFinite(inputs[k]!)) return null;
  const i = inputs as G1Inputs;
  if (i.total_costs <= 0) return null;
  const components = {
    saudi_salaries: i.saudi_salaries / i.total_costs,
    local_goods_services: i.local_goods_services / i.total_costs,
    local_assets_depreciation: i.local_assets_depreciation / i.total_costs,
    capability_building: i.capability_building / i.total_costs,
  };
  const score = Object.values(components).reduce((s, v) => s + v, 0);
  return { score: Number(score.toFixed(6)), template: "G1 Baseline N.1", components: Object.fromEntries(Object.entries(components).map(([k, v]) => [k, Number(v.toFixed(6))])) };
}
```

`packages/core/src/lcgpa/signals.ts`:

```ts
import type { Sql } from "postgres";

export async function lcSignals(db: Sql, capabilityId: string) {
  const [r] = await db<{ class: string; hs6: string; in_made_in_saudi: boolean; cr_number: string | null; in_tarmeez: boolean; in_mlcp: boolean }[]>`
    select c.class, c.hs6, s.in_made_in_saudi, s.cr_number, s.in_tarmeez, s.in_mlcp from capabilities c join suppliers s on s.id = c.supplier_id where c.id = ${capabilityId}`;
  if (!r) throw new Error(`capability ${capabilityId} not found`);
  const [m] = await db<{ n: number }[]>`select count(*)::int as n from mandatory_list where hs4 = ${r.hs6.slice(0, 4)}`;
  const in_registries = [r.in_tarmeez ? "tarmeez" : null, r.in_mlcp ? "mlcp" : null, r.in_made_in_saudi ? "made_in_saudi" : null].filter(Boolean) as string[];
  return { class: r.class, made_in_saudi: r.in_made_in_saudi, mandatory: (m?.n ?? 0) > 0, cr_present: !!r.cr_number, in_registries, g1: null as null };
}
```

- [ ] **Step 4: Run the test to verify it passes, then commit**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/lcgpa.test.ts`
Expected: PASS, two tests.

```bash
git add packages/core/src/lcgpa packages/core/test/lcgpa.test.ts
git commit -m "feat(core): LC signals and the input-gated LCGPA G1 score"
```

---

### Task 7: The Advisor run

**Files:**
- Create: `packages/core/src/advisor/schema.ts`, `packages/core/src/advisor/run.ts`, `packages/core/scripts/advisor.ts`, `packages/core/scripts/gaps.ts`
- Test: `packages/core/test/advisor.test.ts`

**Interfaces:**
- Produces: zod `InvestmentCase = { headline: string; why_now: string; annual_value_usd: number; regulatory_pressure: string; pivot_candidates: { supplier_id: string; supplier_name: string; why: string; what_they_have: string; what_is_missing: string }[]; raw_materials: string; recommended_next_step: string }` and a loose variant; `adjacentSuppliers(db, order): Promise<Adjacent[]>` returning supported capabilities under the same heading, then under related headings (7307 and 8481 both ways, 8413 and 8481, 7412 and 7307), then same-material suppliers in the sector, ranked; `runAdvisor(db, orderId)` persisting into `gap_cases`; `advisorPrompt(order, adjacent, mining, imports)`.

- [ ] **Step 1: Write the failing test**

`packages/core/test/advisor.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { InvestmentCaseLoose } from "../src/advisor/schema";
import { adjacentSuppliers, advisorPrompt, runAdvisor } from "../src/advisor/run";
import { ollamaUp } from "../src/models/registry";

describe("InvestmentCaseLoose", () => {
  test("coerces a sloppy case", () => {
    const c = InvestmentCaseLoose.parse({ headline: "h", annual_value_usd: "1,200,000", pivot_candidates: [{ supplier_id: "tarmeez:1", supplier_name: "X", why: "w" }], raw_materials: null });
    expect(c.annual_value_usd).toBe(1200000);
    expect(c.pivot_candidates[0]!.what_is_missing).toBe("");
    expect(c.raw_materials).toBe("");
  });
});

describe.skipIf(!process.env.DATABASE_URL)("adjacency", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from suppliers where id like 'test:adj%'`;
    await sql`insert into suppliers (id, name_en, source, region_en) values ('test:adj1', 'Fittings Plant', 'test', 'Eastern Region'), ('test:adj2', 'Valve Trader', 'test', 'Riyadh Region')`;
    await sql`insert into capabilities (supplier_id, hs6, product_title, class, verdict, confidence, origin) values ('test:adj1', '730793', 'butt weld fittings', 'manufacturer', 'supported', 0.8, 'detective'), ('test:adj2', '848180', 'ball valves', 'trader', 'supported', 0.7, 'detective')`;
    const caps = await sql<{ id: string }[]>`select id from capabilities where supplier_id like 'test:adj%'`;
    for (const c of caps) await sql`insert into evidence (capability_id, tier, source_type, source_url, excerpt) values (${c.id}, 2, 'test', 'https://x', 'x')`;
  });
  test("a fittings manufacturer is adjacent to a valve gap, ahead of a valve trader", async () => {
    const adj = await adjacentSuppliers(sql, { hs6: "848180", spec_envelope: { object_class: "ball valve", object_family: "valve", size_inch: 2, size_dn: 50, pressure_bar: 40, pressure_class: null, material: "stainless_steel", material_grade: null, connection: null } });
    const ids = adj.map((a) => a.supplier_id);
    expect(ids.indexOf("test:adj1")).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf("test:adj1")).toBeLessThan(ids.indexOf("test:adj2"));
    expect(adj[0]!.relation).toBeDefined();
  });
  test("advisorPrompt carries the value, the mandatory flag, the candidates and the no-think switch", () => {
    const p = advisorPrompt({ id: "o", hs6: "848180", title: "stainless ball valve 2 inch", family: "valve", annual_value_usd: 1500000, qty_annual: 4000, portco_count: 3, mandatory: true, spec_envelope: { object_class: "ball valve", object_family: "valve", size_inch: 2, size_dn: 50, pressure_bar: 40, pressure_class: null, material: "stainless_steel", material_grade: null, connection: null } }, [{ supplier_id: "test:adj1", name: "Fittings Plant", hs6: "730793", product: "butt weld fittings", class: "manufacturer", relation: "makes steel fittings under a related heading", region: "Eastern Region" }], [{ name_en: "Ma'aden", website: null }], { value_usd: 1865610792 });
    expect(p.system).toContain("/no_think");
    expect(p.human).toContain("1,500,000");
    expect(p.human).toContain("Mandatory List");
    expect(p.human).toContain("Fittings Plant");
  });
});

describe.skipIf(!process.env.DATABASE_URL || !(await ollamaUp()))("runAdvisor live", () => {
  test("writes an investment case for a manufacturing gap", async () => {
    const [o] = await sql<{ id: string }[]>`insert into pooled_orders (hs6, spec_envelope, family, title, annual_value_usd, qty_annual, portco_count, gap_kind, mandatory) values ('848180', '{"object_class":"ball valve","object_family":"valve","size_inch":2,"size_dn":50,"pressure_bar":40,"pressure_class":null,"material":"stainless_steel","material_grade":null,"connection":null}'::jsonb, 'valve', 'test advisor valve', 1500000, 4000, 3, 'manufacturing_gap', true) returning id`;
    const r = await runAdvisor(sql, o!.id);
    expect(r.case.headline.length).toBeGreaterThan(5);
    const [row] = await sql<{ n: number }[]>`select count(*)::int as n from gap_cases where pooled_order_id = ${o!.id}`;
    expect(row!.n).toBe(1);
  }, 300_000);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/advisor.test.ts`
Expected: FAIL with "Cannot find module '../src/advisor/schema'".

- [ ] **Step 3: Implement schema, run and scripts**

`packages/core/src/advisor/schema.ts`:

```ts
import { z } from "zod";

export const InvestmentCase = z.object({
  headline: z.string().describe("One line: the opportunity in plain words"),
  why_now: z.string().describe("Two sentences: pooled demand, regulatory pressure, timing"),
  annual_value_usd: z.number().describe("Annual value of the pooled demand in USD"),
  regulatory_pressure: z.string().describe("What the Mandatory List or local-content rules require for this product, or 'none on record'"),
  pivot_candidates: z.array(z.object({ supplier_id: z.string(), supplier_name: z.string(), why: z.string().describe("Why this plant could make it"), what_they_have: z.string().describe("Equipment, process or material capability they already show"), what_is_missing: z.string().describe("What they would need to add") })),
  raw_materials: z.string().describe("Domestic raw material availability for this product, naming mining companies or sources when known, or 'unknown'"),
  recommended_next_step: z.string().describe("One concrete action for PIF's local content team"),
});
export type InvestmentCaseT = z.infer<typeof InvestmentCase>;

const record = (raw: unknown): Record<string, unknown> => (raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {});
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown): number => { const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(n) ? n : 0; };

export const InvestmentCaseLoose: z.ZodType<InvestmentCaseT> = z.preprocess((raw) => {
  const r = record(raw);
  return {
    headline: str(r.headline), why_now: str(r.why_now), annual_value_usd: num(r.annual_value_usd), regulatory_pressure: str(r.regulatory_pressure),
    pivot_candidates: (Array.isArray(r.pivot_candidates) ? r.pivot_candidates : []).map((c) => { const x = record(c); return { supplier_id: str(x.supplier_id), supplier_name: str(x.supplier_name), why: str(x.why), what_they_have: str(x.what_they_have), what_is_missing: str(x.what_is_missing) }; }).filter((c) => c.supplier_id || c.supplier_name),
    raw_materials: str(r.raw_materials), recommended_next_step: str(r.recommended_next_step),
  };
}, InvestmentCase);
```

`packages/core/src/advisor/run.ts`:

```ts
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { Sql } from "postgres";
import type { Envelope } from "../coordinator/pool";
import { getChatModel, modelRefFor } from "../models/registry";
import { invokeStructured } from "../models/structured";
import { withRun } from "../trajectory/handler";
import { addStep } from "../trajectory/store";
import { InvestmentCase, InvestmentCaseLoose, type InvestmentCaseT } from "./schema";

export type Adjacent = { supplier_id: string; name: string; hs6: string; product: string; class: string; relation: string; region: string | null };
type OrderForAdvice = { id: string; hs6: string; title: string; family: string | null; annual_value_usd: number | null; qty_annual: number | null; portco_count: number; mandatory: boolean; spec_envelope: Envelope };

const RELATED: Record<string, string[]> = { "8481": ["7307", "8413", "7412"], "8413": ["8481", "8414"], "7307": ["8481", "7412", "7304", "7306"], "7412": ["7307", "8481"] };

export async function adjacentSuppliers(db: Sql, order: { hs6: string; spec_envelope: Envelope }): Promise<Adjacent[]> {
  const heading = order.hs6.slice(0, 4);
  const related = RELATED[heading] ?? [];
  const rows = await db<{ supplier_id: string; name: string; hs6: string; product: string; class: string; region: string | null; best_tier: number | null; spec_attrs: Record<string, string> }[]>`
    select c.supplier_id, coalesce(s.name_en, s.name_ar, s.id) as name, c.hs6, coalesce(c.product_title, p.title_en, c.hs6) as product, c.class, s.region_en as region, e.best_tier, c.spec_attrs
    from capabilities c join suppliers s on s.id = c.supplier_id left join products p on p.tariff_code = c.tariff_code
    left join (select capability_id, min(tier)::int as best_tier from evidence group by capability_id) e on e.capability_id = c.id
    where c.verdict = 'supported' and e.best_tier <= 2 and (left(c.hs6, 4) = ${heading} or left(c.hs6, 4) = any(${related}))`;
  const material = order.spec_envelope.material ?? "";
  const score = (r: typeof rows[number]) => {
    const maker = r.class === "manufacturer" || r.class === "assembler";
    const sameHeading = r.hs6.slice(0, 4) === heading;
    const mat = material && JSON.stringify(r.spec_attrs ?? {}).toLowerCase().includes(material.split("_")[0]!) ? 1 : 0;
    return (maker ? 4 : 0) + (sameHeading ? (maker ? 1 : 2) : 3) + mat;
  };
  return rows
    .map((r) => ({ r, s: score(r) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map(({ r }) => ({ supplier_id: r.supplier_id, name: r.name, hs6: r.hs6, product: r.product, class: r.class, region: r.region,
      relation: r.hs6.slice(0, 4) === heading ? (r.class === "manufacturer" || r.class === "assembler" ? "already makes a product under this heading" : `supplies this heading as a ${r.class.replace(/_/g, " ")}`) : `makes ${r.product} under related heading ${r.hs6.slice(0, 4)}, similar materials and processes` }));
}

export function advisorPrompt(order: OrderForAdvice, adjacent: Adjacent[], mining: { name_en: string | null; website: string | null }[], imports: { value_usd: number } | null): { system: string; human: string } {
  const adj = adjacent.map((a, i) => `${i + 1}. ${a.name} (${a.supplier_id}), ${a.region ?? "region unknown"}: ${a.product} [HS ${a.hs6}], ${a.class.replace(/_/g, " ")}; ${a.relation}`).join("\n") || "(no adjacent supported capability on record)";
  const mines = mining.slice(0, 12).map((m) => m.name_en).filter(Boolean).join("; ") || "none on record";
  return {
    system: [
      "You are an industrial investment advisor to PIF's local content team. You turn one gap in domestic supply into a one-paragraph investment case grounded only in the facts given.",
      "Pivot candidates must come from the adjacent suppliers listed; never invent a company. Explain what each already has and what it would need. Use the mining companies only as raw-material context and say 'unknown' when the link is not evident.",
      "Numbers: use the annual value given. Regulatory pressure: state the Mandatory List status given. Keep every field concise.",
      "/no_think",
    ].join("\n"),
    human: `Gap: ${order.title} (HS ${order.hs6}, family ${order.family ?? "unknown"})\nPooled annual demand across ${order.portco_count} portfolio companies: ${order.qty_annual ? Math.round(order.qty_annual).toLocaleString("en-US") + " units, " : ""}USD ${Math.round(order.annual_value_usd ?? 0).toLocaleString("en-US")} per year\nNational imports 2024 for this subheading: USD ${imports ? Math.round(imports.value_usd).toLocaleString("en-US") : "unknown"}\nMandatory List: ${order.mandatory ? "yes, this heading is on the announced tranche requiring minimum local content from 1 August 2027" : "not on the announced tranches"}\nSpecification envelope: ${JSON.stringify(order.spec_envelope)}\n\nAdjacent suppliers with supported capabilities:\n${adj}\n\nMining and geological companies on record: ${mines}`,
  };
}

export async function runAdvisor(db: Sql, orderId: string): Promise<{ runId: string; case: InvestmentCaseT }> {
  const [order] = await db<OrderForAdvice[]>`select id, hs6, coalesce(title, hs6) as title, family, annual_value_usd::float as annual_value_usd, qty_annual::float as qty_annual, portco_count, mandatory, spec_envelope from pooled_orders where id = ${orderId}`;
  if (!order) throw new Error(`pooled order ${orderId} not found`);
  const [imports] = await db<{ value_usd: number }[]>`select value_usd::float as value_usd from imports where hs6 = ${order.hs6} and year = 2024`;
  const mining = await db<{ name_en: string | null; website: string | null }[]>`select name_en, website from mining_companies order by id`;
  return withRun(db, { role: "advisor", inputRef: orderId, model: modelRefFor("advisor") }, async (runId, handler) => {
    const t = Date.now();
    const adjacent = await adjacentSuppliers(db, order);
    await addStep(db, runId, { kind: "retrieval", name: "adjacent_suppliers", input: { hs6: order.hs6 }, output: adjacent.map((a) => `${a.supplier_id} ${a.class} ${a.hs6}`), durationMs: Date.now() - t });
    const p = advisorPrompt(order, adjacent, mining, imports ?? null);
    const c = await invokeStructured(getChatModel("advisor"), [new SystemMessage(p.system), new HumanMessage(p.human)], {
      name: "investment_case", description: "The investment case for closing one domestic supply gap", toolSchema: InvestmentCase, parseSchema: InvestmentCaseLoose,
      config: { callbacks: [handler], runName: "advise" },
      onRetry: (issues) => addStep(db, runId, { kind: "note", name: "advise_retry", output: { issues } }),
    });
    const known = new Set(adjacent.map((a) => a.supplier_id));
    c.pivot_candidates = c.pivot_candidates.filter((x) => known.has(x.supplier_id) || adjacent.some((a) => a.name === x.supplier_name)).map((x) => ({ ...x, supplier_id: known.has(x.supplier_id) ? x.supplier_id : adjacent.find((a) => a.name === x.supplier_name)!.supplier_id }));
    if (!c.annual_value_usd) c.annual_value_usd = order.annual_value_usd ?? 0;
    await db`insert into gap_cases (pooled_order_id, run_id, "case") values (${orderId}, ${runId}, ${db.json(c as never)}) on conflict (pooled_order_id) do update set run_id = excluded.run_id, "case" = excluded."case", created_at = now()`;
    await addStep(db, runId, { kind: "note", name: "case", output: { headline: c.headline, pivots: c.pivot_candidates.length } });
    return { runId, case: c };
  });
}
```

`packages/core/scripts/advisor.ts`:

```ts
import { sql } from "../src/db/client";
import { runAdvisor } from "../src/advisor/run";

const limit = Number(process.argv[2] ?? "50");
const gaps = await sql<{ id: string; title: string }[]>`select o.id, o.title from pooled_orders o left join gap_cases g on g.pooled_order_id = o.id where o.gap_kind = 'manufacturing_gap' and g.pooled_order_id is null order by o.annual_value_usd desc nulls last limit ${limit}`;
console.log(`manufacturing gaps without a case: ${gaps.length}`);
for (const g of gaps) { try { const r = await runAdvisor(sql, g.id); console.log(`${g.title}: ${r.case.headline} (${r.case.pivot_candidates.length} pivots)`); } catch (err) { console.error(g.id, (err as Error).message); } }
await sql.end();
```

`packages/core/scripts/gaps.ts`:

```ts
import { sql } from "../src/db/client";
const rows = await sql<{ title: string; hs6: string; gap_kind: string; mandatory: boolean; annual_value_usd: number; portco_count: number; pivots: number | null; headline: string | null }[]>`
  select o.title, o.hs6, o.gap_kind, o.mandatory, o.annual_value_usd::float as annual_value_usd, o.portco_count, jsonb_array_length(g."case"->'pivot_candidates') as pivots, g."case"->>'headline' as headline
  from pooled_orders o left join gap_cases g on g.pooled_order_id = o.id where o.gap_kind <> 'covered' order by o.gap_kind, o.annual_value_usd desc nulls last`;
console.log("gap kind            mandatory  USD/yr        portcos  pivots  title / headline");
for (const r of rows) console.log(`${r.gap_kind.padEnd(19)} ${(r.mandatory ? "yes" : "no").padEnd(10)} ${Math.round(r.annual_value_usd ?? 0).toLocaleString("en-US").padStart(12)}  ${String(r.portco_count).padStart(7)}  ${String(r.pivots ?? "-").padStart(6)}  ${r.title}${r.headline ? " / " + r.headline : ""}`);
await sql.end();
```

Add root scripts `"advisor"` and `"gaps"`.

- [ ] **Step 4: Run the tests, then the advisor over the gaps that exist**

Run: `perl -e 'alarm 400; exec @ARGV' bun test packages/core/test/advisor.test.ts && bun run gaps`
Expected: PASS; the ledger prints. Then `nohup bun run advisor > <scratch>/advisor.log 2>&1 &` once pooled orders and matches exist.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/advisor packages/core/scripts/advisor.ts packages/core/scripts/gaps.ts packages/core/test/advisor.test.ts package.json
git commit -m "feat(core): Advisor run: adjacency, investment case per manufacturing gap, gap ledger script"
```

---

### Task 8: Record the demand-side numbers

**Files:**
- Modify: `FACTS.md` section 2, `docs/eval/` (new evidence file), `packages/core/README.md`, `BUILD_PLAN.md` Hour 16 to 40

- [ ] **Step 1: After resolution, matching and the advisor have run, capture the numbers**

Run: `bun run coverage && bun run gaps && bun run cost`

Write `docs/eval/2026-09-02-coverage-and-gaps.md` with: the demand set size and its total annual value with the portfolio share constant, the coverage and line coverage, the counts of covered orders, manufacturing gaps and supply gaps, the top ten gaps by value with their mandatory flag and pivot count, and the discovery lift. Append the coverage sentence to `FACTS.md` section 2 with its date. Add the new commands to the README and note in `BUILD_PLAN.md` that the demand set is generated by `demand:generate` with `PORTFOLIO_IMPORT_SHARE`.

- [ ] **Step 2: Commit**

```bash
git add FACTS.md docs/eval BUILD_PLAN.md packages/core/README.md
git commit -m "docs: coverage, gap ledger and discovery lift as measured"
```

---

## Self-review

**Spec coverage.** BUILD_PLAN Hour 16 to 28: demand set anchored to Comtrade with messy bilingual lines, Tasks 2 and 3; Coordinator over the full set with pooling, Task 4; candidate retrieval and ranking by spec fit, confidence, evidence and region, Task 5; LCGPA G1 as a documented input-gated function with LC signals, Task 6. Hour 28 to 40: Advisor with pooled value, Mandatory List, adjacency, pivot candidates and raw materials, Task 7; gap ledger ranked by value with regulatory flag and pivot candidates, Tasks 5 and 7; coverage as the header number, Task 5. CONTEXT terms: Pooled order, Spec envelope, Supported capability, Coverage, Line coverage, Manufacturing gap, Supply gap, LC signal, G1 score all have code with those names.

**Placeholder scan.** Every code step is a full file. Task 8 describes a document whose content is the measured output of Task 5 and 7 scripts.

**Type consistency.** `Envelope` from `coordinator/pool.ts` is used by `match/score.ts`, `match/persist.ts` and `advisor/run.ts`; `CapabilityCandidate` from `match/score.ts` by `match/persist.ts`; `poolLines` from milestone 1 by `demand/pool.ts`; `InvestmentCaseT` by `advisor/run.ts`; column names match `0005_demand.sql` and earlier migrations.
