# KAMIN Milestone 4: The Three Screens and the Stage, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The demo surface: a Next.js app over the graph with the gap ledger, the capability view, the evidence drill-down that renders a run's trajectory, a spend-weighted coverage header, the global simulated-demand disclosure, and the live cold-miss that streams a Detective and an Auditor investigating an unenriched Tarmeez supplier on stage, with a recorded fallback. Plus the hardening BUILD_PLAN lists: a frozen snapshot, one document of every number said aloud with its source query, a demo runbook, and a Langfuse compose file for when disk allows.

**Architecture:** `apps/web` is a Next.js App Router application that imports `@kamin/core` through the Bun workspace and reads Postgres in server components through one query module. The only mutation path is the cold-miss route handler, which runs the core Detective and Auditor and streams their trajectory lines as Server-Sent Events. Core gets two small changes so it runs under Node inside Next: repository-relative paths resolved from the module URL or `KAMIN_ROOT`, and a `sink` option on runs so trajectory lines can go to a stream instead of the console.

**Tech Stack:** Next.js 16 (App Router, TypeScript), React 19, Tailwind CSS v4, `@kamin/core`, Bun for install and tests. No UI component library.

**Spec:** `BUILD_PLAN.md` (Hour 28 to 40 UI, Hour 40 to 48, demo script steps 1 to 6), `CONTEXT.md`, `docs/adr/0003`, the demo decisions in FACTS section 8 (known-supplier cold miss, global disclosure, coverage as header).

## Global Constraints

- All milestone 1 to 3 constraints hold. Every screen shows the disclosure line "Demand is simulated on real Comtrade import values" and names the portfolio share constant.
- Screens read only; the cold-miss route is the single write path and it calls core's runs unchanged.
- The header figure is spend-weighted coverage; line coverage sits beside it in smaller type.
- Arabic strings render with `dir="auto"`. Numbers are formatted with `Intl.NumberFormat("en-US")`; money is USD with no decimals.
- The Next app runs from the repository root through root scripts that set `KAMIN_ROOT`; `apps/web/.env` is a symlink to the root `.env`.
- No em dashes in copy. No model calls except the cold-miss route and the recording script.

---

## File structure

```
packages/core/src/paths.ts                 REPO_ROOT from KAMIN_ROOT or the module URL (Node and Bun)
packages/core/src/trajectory/handler.ts    withRun(db, meta, fn, { sink })
packages/core/src/detective/run.ts         runDetective(db, id, { sink })
packages/core/src/auditor/run.ts           runAuditor(db, id, { sink })
packages/core/scripts/record-cold-miss.ts  records a live cold miss to apps/web/public/cold-miss/<id>.json
packages/core/scripts/db-snapshot.ts, db-restore.ts
apps/web/
  package.json, next.config.ts, tsconfig.json, postcss.config.mjs, .env -> ../../.env
  app/layout.tsx, app/globals.css          header with coverage, nav, disclosure
  app/page.tsx                             gap ledger
  app/orders/[id]/page.tsx                 pooled order: lines, matches, investment case
  app/suppliers/page.tsx                   capability view with filters
  app/suppliers/[id]/page.tsx              supplier: registries, capabilities, evidence, runs, cold-miss button
  app/evidence/[id]/page.tsx               capability drill-down: evidence chain, lenses, LC signals, trajectories
  app/runs/[id]/page.tsx                   one run's steps
  app/api/cold-miss/[supplierId]/route.ts  SSE stream
  components/ColdMiss.tsx                  client: live stream or recording playback
  components/ui.tsx                        Money, Pct, Tier, Verdict, ClassBadge, Table primitives
  lib/db.ts, lib/queries.ts, lib/format.ts
  test/queries.test.ts
docker-compose.langfuse.yml
docs/numbers.md, docs/demo-runbook.md
```

---

### Task 1: Core under Node, sinks, and the web scaffold

**Files:**
- Create: `packages/core/src/paths.ts`, `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/tsconfig.json`, `apps/web/postcss.config.mjs`, `apps/web/app/globals.css`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx` (placeholder replaced in Task 3), `apps/web/lib/db.ts`, `apps/web/lib/format.ts`
- Modify: every core file using `import.meta.dir` (`tarmeez/client.ts`, `web/tavily.ts`, `web/fetch.ts`, `mlcp/ingest.ts`, `madeinsaudi/capture.ts`, `comtrade/ingest.ts`, `db/migrate.ts`), `trajectory/handler.ts`, `detective/run.ts`, `auditor/run.ts`, `db/client.ts`, root `package.json`
- Test: `packages/core/test/paths.test.ts`, `packages/core/test/trajectory.test.ts` (sink case), `apps/web/test/format.test.ts`

**Interfaces:**
- Produces: `REPO_ROOT: string` and `dataDir(...parts: string[]): string` from `packages/core/src/paths.ts`; `withRun(db, meta, fn, opts?: { sink?: (line: string) => void })`; `runDetective(db, supplierId, opts?: { sink? })`; `runAuditor(db, capabilityId, opts?: { sink? })`; `fmtMoney(n)`, `fmtPct(x)`, `fmtInt(n)` in `apps/web/lib/format.ts`.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/paths.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { dataDir, REPO_ROOT } from "../src/paths";

describe("paths", () => {
  test("REPO_ROOT is the repository root whether or not KAMIN_ROOT is set", () => {
    expect(existsSync(join(REPO_ROOT, "package.json"))).toBe(true);
    expect(existsSync(join(REPO_ROOT, "packages/core/package.json"))).toBe(true);
    expect(dataDir("raw", "tarmeez")).toBe(join(REPO_ROOT, "data/raw/tarmeez"));
  });
});
```

Append to `packages/core/test/trajectory.test.ts` inside the describe:

```ts
  test("withRun routes trajectory lines to a provided sink", async () => {
    const lines: string[] = [];
    await withRun(sql, { role: "coordinator", inputRef: "test-sink", model: "m" }, async (_runId, handler) => { handler.sink("hello sink"); return 1; }, { sink: (l) => lines.push(l) });
    expect(lines.some((l) => l.includes("hello sink"))).toBe(true);
    expect(lines.some((l) => l.startsWith("▶ run"))).toBe(true);
  });
```

`apps/web/test/format.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { fmtInt, fmtMoney, fmtPct } from "../lib/format";

describe("format", () => {
  test("money, integers and percentages", () => {
    expect(fmtMoney(1234567.8)).toBe("$1,234,568");
    expect(fmtInt(4000.4)).toBe("4,000");
    expect(fmtPct(0.4567)).toBe("45.7%");
    expect(fmtMoney(null)).toBe("n/a");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/paths.test.ts apps/web/test/format.test.ts`
Expected: FAIL with "Cannot find module '../src/paths'".

- [ ] **Step 3: Implement paths, sinks and the scaffold**

`packages/core/src/paths.ts`:

```ts
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function fromModule(): string {
  try {
    return resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  } catch {
    return process.cwd();
  }
}

export const REPO_ROOT: string = process.env.KAMIN_ROOT ? resolve(process.env.KAMIN_ROOT) : fromModule();
export const dataDir = (...parts: string[]): string => join(REPO_ROOT, "data", ...parts);
```

In each file that defines `const REPO_ROOT = join(import.meta.dir, ...)`, replace it with `import { REPO_ROOT } from "../paths";` (or `"../../paths"` for `db/migrate.ts`, which uses `join(REPO_ROOT, "packages/core/src/db/migrations")` for `dir`). In `madeinsaudi/capture.ts` and `comtrade/ingest.ts`, `mlcp/ingest.ts`, `web/*.ts`, `tarmeez/client.ts` the cache directories become `join(REPO_ROOT, "data/raw/...")` exactly as before.

`packages/core/src/db/client.ts` becomes:

```ts
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const g = globalThis as unknown as { __kaminSql?: ReturnType<typeof postgres> };
export const sql = g.__kaminSql ?? (g.__kaminSql = postgres(url, { max: 8, onnotice: () => {} }));
```

In `trajectory/handler.ts`, `withRun` gains a fourth parameter `opts: { sink?: (line: string) => void } = {}` and sets `if (opts.sink) handler.sink = opts.sink;` right after constructing the handler. In `detective/run.ts` and `auditor/run.ts`, add `opts: { sink?: (line: string) => void } = {}` as the last parameter and pass `{ sink: opts.sink }` to `withRun`.

`apps/web/package.json`:

```json
{
  "name": "@kamin/web",
  "private": true,
  "type": "module",
  "scripts": { "dev": "next dev", "build": "next build", "start": "next start", "typecheck": "tsc --noEmit" },
  "dependencies": { "@kamin/core": "workspace:*", "next": "^16.2.9", "react": "^19.2.0", "react-dom": "^19.2.0" },
  "devDependencies": { "@tailwindcss/postcss": "^4.1.0", "@types/react": "^19.2.0", "@types/react-dom": "^19.2.0", "tailwindcss": "^4.1.0", "typescript": "^5.9.0", "bun-types": "^1.3.0" }
}
```

`apps/web/next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kamin/core"],
  serverExternalPackages: ["postgres", "playwright", "p-limit", "@langchain/core", "@langchain/langgraph", "@langchain/ollama", "@langchain/anthropic", "@langchain/openai", "@langchain/deepseek"],
};
export default nextConfig;
```

`apps/web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["dom", "dom.iterable", "esnext"], "module": "esnext", "moduleResolution": "bundler", "jsx": "preserve",
    "strict": true, "noUncheckedIndexedAccess": true, "skipLibCheck": true, "esModuleInterop": true, "resolveJsonModule": true, "isolatedModules": true, "incremental": true, "noEmit": true,
    "plugins": [{ "name": "next" }], "paths": { "@/*": ["./*"] }, "types": ["bun-types"]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/web/postcss.config.mjs`: `export default { plugins: { "@tailwindcss/postcss": {} } };`

`apps/web/app/globals.css`:

```css
@import "tailwindcss";

:root { --ink: #14110f; --paper: #f7f4ee; --accent: #e8541e; --muted: #6b655c; --line: #e2dcd2; }
html { background: var(--paper); color: var(--ink); }
body { font-family: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif; }
.mono { font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }
[dir="auto"] { unicode-bidi: plaintext; }
```

`apps/web/lib/db.ts`: `export { sql } from "@kamin/core/src/db/client";`

`apps/web/lib/format.ts`:

```ts
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const fmtMoney = (n: number | null | undefined): string => (n === null || n === undefined || !Number.isFinite(n) ? "n/a" : money.format(n));
export const fmtInt = (n: number | null | undefined): string => (n === null || n === undefined || !Number.isFinite(n) ? "n/a" : int.format(n));
export const fmtPct = (x: number | null | undefined): string => (x === null || x === undefined || !Number.isFinite(x) ? "n/a" : `${(x * 100).toFixed(1)}%`);
export const classLabel = (c: string): string => c.replace(/_/g, " ");
```

`apps/web/app/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import { coverageSummary } from "@/lib/queries";
import { fmtMoney, fmtPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const c = await coverageSummary();
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b" style={{ borderColor: "var(--line)" }}>
          <div className="mx-auto flex max-w-7xl items-end justify-between gap-6 px-6 py-4">
            <div>
              <Link href="/" className="text-2xl font-semibold tracking-tight">KAMIN <span style={{ color: "var(--muted)" }}>كامن</span></Link>
              <nav className="mt-1 flex gap-4 text-sm" style={{ color: "var(--muted)" }}>
                <Link href="/">Gap ledger</Link>
                <Link href="/suppliers">Capabilities</Link>
              </nav>
            </div>
            <div className="text-right">
              <div className="mono text-4xl font-semibold" style={{ color: "var(--accent)" }}>{fmtPct(c.coverage)}</div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>of {fmtMoney(c.spend_total)} a year in pooled portfolio demand has a supported local supplier. Line coverage {fmtPct(c.line_coverage)}.</div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-6 py-6 text-xs" style={{ color: "var(--muted)" }}>
          Demand is simulated on real Comtrade import values for Saudi Arabia, 2024, at a portfolio share of 12%. Supply is real: Tarmeez, MLCP, Made in Saudi and public evidence read by agents. Every claim carries its evidence and its auditor verdict.
        </footer>
      </body>
    </html>
  );
}
```

`apps/web/app/page.tsx` for now: `export default function Page() { return <p>Gap ledger arrives in Task 3.</p>; }`

Root `package.json` scripts: `"web:dev": "KAMIN_ROOT=$PWD bun run --cwd apps/web dev"`, `"web:build": "KAMIN_ROOT=$PWD bun run --cwd apps/web build"`, `"typecheck:web": "cd apps/web && tsc --noEmit"`, `"demo": "bun run db:up && bun run web:dev"`. Then:

```bash
cd apps/web && ln -sf ../../.env .env && cd ../.. && bun install
```

- [ ] **Step 4: Run the tests, the core suite and the web typecheck**

Run: `perl -e 'alarm 120; exec @ARGV' bun test packages/core/test/paths.test.ts packages/core/test/trajectory.test.ts apps/web/test/format.test.ts && bun run typecheck && bun run typecheck:web`
Expected: PASS; both typechecks clean. `coverageSummary` does not exist yet, so create `apps/web/lib/queries.ts` with only that function in this task (its body is in Task 2, copy it from there); Task 2 adds the rest.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src apps/web package.json bun.lock packages/core/test/paths.test.ts packages/core/test/trajectory.test.ts
git commit -m "feat(web): Next.js scaffold over the graph; core paths and sinks for Node"
```

---

### Task 2: The query module

**Files:**
- Create: `apps/web/lib/queries.ts`
- Test: `apps/web/test/queries.test.ts`

**Interfaces:**
- Produces (all read-only, all typed): `coverageSummary()`, `stats()`, `ledger(kind: "manufacturing_gap" | "supply_gap" | "covered" | "all")`, `orderDetail(id)`, `supplierList(filters: { family?: string; region?: string; cls?: string; verdict?: string; registry?: string; q?: string })`, `supplierDetail(id)`, `capabilityDetail(id)`, `runDetail(id)`, `unenrichedSectorSuppliers(limit)`.

- [ ] **Step 1: Write the failing test**

`apps/web/test/queries.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { capabilityDetail, coverageSummary, ledger, orderDetail, runDetail, stats, supplierDetail, supplierList, unenrichedSectorSuppliers } from "../lib/queries";

describe.skipIf(!process.env.DATABASE_URL)("queries", () => {
  test("coverage and stats answer with numbers", async () => {
    const c = await coverageSummary();
    expect(c.coverage).toBeGreaterThanOrEqual(0);
    const s = await stats();
    expect(s.suppliers).toBeGreaterThan(10000);
    expect(s.capabilities).toBeGreaterThan(10000);
  });
  test("ledger rows carry value, kind, mandatory flag and pivot count", async () => {
    const rows = await ledger("all");
    expect(Array.isArray(rows)).toBe(true);
    if (rows.length) expect(rows[0]).toHaveProperty("annual_value_usd");
  });
  test("supplier list filters by registry and text, and detail returns capabilities with evidence", async () => {
    const list = await supplierList({ registry: "tarmeez", q: "كانو", family: "valve" });
    expect(list.length).toBeGreaterThan(0);
    const d = await supplierDetail("tarmeez:41699");
    expect(d).not.toBeNull();
    expect(d!.capabilities.length).toBeGreaterThan(0);
    expect(d!.capabilities[0]).toHaveProperty("evidence_count");
    const cap = await capabilityDetail(d!.capabilities[0]!.id);
    expect(cap!.evidence.length).toBeGreaterThanOrEqual(1);
    const runs = d!.runs;
    if (runs.length) { const r = await runDetail(runs[0]!.id); expect(r!.steps.length).toBeGreaterThan(0); }
  });
  test("an order detail joins lines and matches when one exists", async () => {
    const rows = await ledger("all");
    if (!rows.length) return;
    const o = await orderDetail(rows[0]!.id);
    expect(o).not.toBeNull();
    expect(o!.lines.length).toBeGreaterThan(0);
  });
  test("unenriched sector suppliers are pending Tarmeez plants with sector capabilities", async () => {
    const rows = await unenrichedSectorSuppliers(5);
    expect(rows.every((r) => r.detective_status === "pending")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `perl -e 'alarm 120; exec @ARGV' bun test apps/web/test/queries.test.ts`
Expected: FAIL with "Export named 'ledger' not found" (or the module missing if Task 1's stub was not created).

- [ ] **Step 3: Implement the queries**

`apps/web/lib/queries.ts`:

```ts
import { sql } from "./db";

export type GapKind = "covered" | "manufacturing_gap" | "supply_gap";

export async function coverageSummary() {
  const [r] = await sql<{ spend_total: number; spend_covered: number; line_total: number; line_covered: number; manufacturing_gaps: number; supply_gaps: number; covered: number }[]>`
    select coalesce(sum(annual_value_usd), 0)::float as spend_total,
           coalesce(sum(annual_value_usd) filter (where gap_kind in ('covered', 'manufacturing_gap')), 0)::float as spend_covered,
           count(*)::int as line_total,
           count(*) filter (where gap_kind in ('covered', 'manufacturing_gap'))::int as line_covered,
           count(*) filter (where gap_kind = 'manufacturing_gap')::int as manufacturing_gaps,
           count(*) filter (where gap_kind = 'supply_gap')::int as supply_gaps,
           count(*) filter (where gap_kind = 'covered')::int as covered
    from pooled_orders where title not like 'test %'`;
  const row = r!;
  return { ...row, coverage: row.spend_total ? row.spend_covered / row.spend_total : 0, line_coverage: row.line_total ? row.line_covered / row.line_total : 0 };
}

export async function stats() {
  const [r] = await sql<{ suppliers: number; investigated: number; capabilities: number; supported: number; refuted: number; evidence: number; runs: number; discovered: number }[]>`
    select (select count(*) from suppliers where id not like 'test:%')::int as suppliers,
           (select count(*) from suppliers where detective_status = 'ok' and id not like 'test:%')::int as investigated,
           (select count(*) from capabilities c join suppliers s on s.id = c.supplier_id where s.id not like 'test:%')::int as capabilities,
           (select count(*) from capabilities where verdict = 'supported')::int as supported,
           (select count(*) from capabilities where verdict = 'refuted')::int as refuted,
           (select count(*) from evidence)::int as evidence,
           (select count(*) from runs where input_ref not like 'test%')::int as runs,
           (select count(*) from suppliers where source in ('hunt', 'made_in_saudi', 'mlcp') and not in_tarmeez)::int as discovered`;
  return r!;
}

export type LedgerRow = { id: string; title: string; hs6: string; family: string | null; gap_kind: GapKind | null; mandatory: boolean; annual_value_usd: number | null; qty_annual: number | null; qty_unit: string | null; portco_count: number; line_count: number; pivots: number | null; headline: string | null; supported_count: number };

export async function ledger(kind: GapKind | "all"): Promise<LedgerRow[]> {
  const filter = kind === "all" ? sql`` : sql`and o.gap_kind = ${kind}`;
  return sql<LedgerRow[]>`
    select o.id, o.title, o.hs6, o.family, o.gap_kind, o.mandatory, o.annual_value_usd::float as annual_value_usd, o.qty_annual::float as qty_annual, o.qty_unit, o.portco_count,
           (select count(*)::int from demand_lines d where d.pooled_order_id = o.id) as line_count,
           jsonb_array_length(g."case"->'pivot_candidates') as pivots, g."case"->>'headline' as headline,
           (select count(*)::int from matches m join capabilities c on c.id = m.capability_id left join (select capability_id, min(tier) as best from evidence group by capability_id) e on e.capability_id = c.id where m.pooled_order_id = o.id and c.verdict = 'supported' and e.best <= 2) as supported_count
    from pooled_orders o left join gap_cases g on g.pooled_order_id = o.id
    where o.title not like 'test %' ${filter}
    order by o.annual_value_usd desc nulls last`;
}

export async function orderDetail(id: string) {
  const [o] = await sql<(LedgerRow & { spec_envelope: Record<string, unknown>; qty_now: number | null; gap_case: Record<string, unknown> | null; import_value_usd: number | null })[]>`
    select o.id, o.title, o.hs6, o.family, o.gap_kind, o.mandatory, o.annual_value_usd::float as annual_value_usd, o.qty_annual::float as qty_annual, o.qty_now::float as qty_now, o.qty_unit, o.portco_count, o.spec_envelope,
           0 as line_count, jsonb_array_length(g."case"->'pivot_candidates') as pivots, g."case"->>'headline' as headline, g."case" as gap_case, 0 as supported_count,
           (select value_usd::float from imports i where i.hs6 = o.hs6 and i.year = 2024) as import_value_usd
    from pooled_orders o left join gap_cases g on g.pooled_order_id = o.id where o.id = ${id}`;
  if (!o) return null;
  const lines = await sql<{ id: string; raw_text: string; portco: string; source_system: string | null; qty: number | null; qty_unit: string | null; history_factor: number; annual_value_usd: number | null; hs6: string | null; confidence: number | null; run_id: string | null }[]>`
    select id, raw_text, portco, source_system, qty::float as qty, qty_unit, history_factor::float as history_factor, annual_value_usd::float as annual_value_usd, hs6, confidence::float as confidence, run_id from demand_lines where pooled_order_id = ${id} order by portco, raw_text`;
  const matches = await sql<{ capability_id: string; supplier_id: string; supplier_name: string; region: string | null; product: string; class: string; verdict: string; confidence: number | null; best_tier: number | null; score: number; share: number | null; rank: number; reasons: Record<string, unknown>; in_made_in_saudi: boolean }[]>`
    select m.capability_id, c.supplier_id, coalesce(s.name_en, s.name_ar, s.id) as supplier_name, s.region_en as region, coalesce(c.product_title, p.title_en, c.hs6) as product, c.class, c.verdict, c.confidence::float as confidence, e.best_tier, m.score::float as score, m.share::float as share, m.rank, m.reasons, s.in_made_in_saudi
    from matches m join capabilities c on c.id = m.capability_id join suppliers s on s.id = c.supplier_id left join products p on p.tariff_code = c.tariff_code
    left join (select capability_id, min(tier)::int as best_tier from evidence group by capability_id) e on e.capability_id = c.id
    where m.pooled_order_id = ${id} order by m.rank`;
  return { ...o, lines, matches };
}

export type SupplierRow = { id: string; name_ar: string | null; name_en: string | null; city_en: string | null; region_en: string | null; source: string; in_tarmeez: boolean; in_mlcp: boolean; in_made_in_saudi: boolean; detective_status: string; capability_count: number; supported_count: number; best_class: string | null };

export async function supplierList(f: { family?: string; region?: string; cls?: string; verdict?: string; registry?: string; q?: string } = {}): Promise<SupplierRow[]> {
  const famLike = f.family === "valve" ? "8481%" : f.family === "pump" ? "8413%" : f.family === "fitting" ? "7307%" : f.family === "flange" ? "7307%" : "%";
  const registry = f.registry === "tarmeez" ? sql`and s.in_tarmeez` : f.registry === "mlcp" ? sql`and s.in_mlcp` : f.registry === "made_in_saudi" ? sql`and s.in_made_in_saudi` : f.registry === "discovered" ? sql`and not s.in_tarmeez` : sql``;
  const region = f.region ? sql`and s.region_en = ${f.region}` : sql``;
  const cls = f.cls ? sql`and c.class = ${f.cls}` : sql``;
  const verdict = f.verdict ? sql`and c.verdict = ${f.verdict}` : sql``;
  const q = f.q ? sql`and (s.name_ar ilike ${"%" + f.q + "%"} or s.name_en ilike ${"%" + f.q + "%"} or s.cr_number = ${f.q})` : sql``;
  return sql<SupplierRow[]>`
    select s.id, s.name_ar, s.name_en, s.city_en, s.region_en, s.source, s.in_tarmeez, s.in_mlcp, s.in_made_in_saudi, s.detective_status,
           count(c.id)::int as capability_count, count(c.id) filter (where c.verdict = 'supported')::int as supported_count,
           (array_agg(c.class order by case c.class when 'manufacturer' then 0 when 'assembler' then 1 when 'authorised_distributor' then 2 else 3 end))[1] as best_class
    from suppliers s join capabilities c on c.supplier_id = s.id
    where s.id not like 'test:%' and c.hs6 like ${famLike} ${registry} ${region} ${cls} ${verdict} ${q}
    group by s.id order by supported_count desc, (s.detective_status = 'ok') desc, capability_count desc, s.id limit 300`;
}

export async function supplierDetail(id: string) {
  const [s] = await sql<{ id: string; name_ar: string | null; name_en: string | null; cr_number: string | null; city_en: string | null; region_en: string | null; website: string | null; source: string; in_tarmeez: boolean; in_mlcp: boolean; in_made_in_saudi: boolean; detective_status: string; summary: string | null; investment_type: string | null }[]>`
    select id, name_ar, name_en, cr_number, city_en, region_en, website, source, in_tarmeez, in_mlcp, in_made_in_saudi, detective_status, summary, investment_type from suppliers where id = ${id}`;
  if (!s) return null;
  const capabilities = await sql<{ id: string; hs6: string; product: string; product_ar: string | null; class: string; verdict: string; confidence: number | null; origin: string; declared_amount: number | null; declared_unit: string | null; evidence_count: number; best_tier: number | null; audited_at: string | null }[]>`
    select c.id, c.hs6, coalesce(c.product_title, p.title_en, c.hs6) as product, p.title_ar as product_ar, c.class, c.verdict, c.confidence::float as confidence, c.origin, c.declared_amount::float as declared_amount, c.declared_unit,
           (select count(*)::int from evidence e where e.capability_id = c.id) as evidence_count, (select min(tier)::int from evidence e where e.capability_id = c.id) as best_tier, c.audited_at::text as audited_at
    from capabilities c left join products p on p.tariff_code = c.tariff_code where c.supplier_id = ${id}
    order by (c.verdict = 'supported') desc, best_tier nulls last, c.hs6`;
  const runs = await sql<{ id: string; role: string; status: string; model: string; started_at: string; seconds: number | null }[]>`
    select r.id, r.role, r.status, r.model, r.started_at::text as started_at, extract(epoch from (r.finished_at - r.started_at))::float as seconds
    from runs r where r.input_ref = ${id} or r.input_ref in (select id::text from capabilities where supplier_id = ${id}) order by r.started_at desc limit 50`;
  return { ...s, capabilities, runs };
}

export async function capabilityDetail(id: string) {
  const [c] = await sql<{ id: string; supplier_id: string; supplier_name: string; supplier_name_ar: string | null; hs6: string; product: string; class: string; verdict: string; confidence: number | null; class_confidence: number | null; lenses: Record<string, unknown> | null; spec_attrs: Record<string, string>; origin: string; declared_amount: number | null; declared_unit: string | null; audit_run_id: string | null; in_made_in_saudi: boolean; in_tarmeez: boolean; in_mlcp: boolean; cr_number: string | null; mandatory: boolean }[]>`
    select c.id, c.supplier_id, coalesce(s.name_en, s.name_ar, s.id) as supplier_name, s.name_ar as supplier_name_ar, c.hs6, coalesce(c.product_title, p.title_en, c.hs6) as product, c.class, c.verdict, c.confidence::float as confidence, c.class_confidence::float as class_confidence, c.lenses, c.spec_attrs, c.origin, c.declared_amount::float as declared_amount, c.declared_unit, c.audit_run_id, s.in_made_in_saudi, s.in_tarmeez, s.in_mlcp, s.cr_number,
           exists (select 1 from mandatory_list m where m.hs4 = left(c.hs6, 4)) as mandatory
    from capabilities c join suppliers s on s.id = c.supplier_id left join products p on p.tariff_code = c.tariff_code where c.id = ${id}`;
  if (!c) return null;
  const evidence = await sql<{ id: string; tier: number; source_type: string; source_url: string; excerpt: string | null; title: string | null; run_id: string | null; fetched_at: string }[]>`
    select id, tier, source_type, source_url, excerpt, title, run_id, fetched_at::text as fetched_at from evidence where capability_id = ${id} order by tier, fetched_at`;
  const runs = await sql<{ id: string; role: string; status: string; model: string; started_at: string; seconds: number | null }[]>`
    select r.id, r.role, r.status, r.model, r.started_at::text as started_at, extract(epoch from (r.finished_at - r.started_at))::float as seconds
    from runs r where r.id = ${c.audit_run_id} or r.id in (select run_id from evidence where capability_id = ${id} and run_id is not null) or r.input_ref = ${c.supplier_id} order by r.started_at`;
  return { ...c, evidence, runs };
}

export async function runDetail(id: string) {
  const [r] = await sql<{ id: string; role: string; input_ref: string; model: string; status: string; error: string | null; started_at: string; finished_at: string | null }[]>`select id, role, input_ref, model, status, error, started_at::text as started_at, finished_at::text as finished_at from runs where id = ${id}`;
  if (!r) return null;
  const steps = await sql<{ seq: number; kind: string; name: string; input: unknown; output: unknown; duration_ms: number | null; tokens_in: number | null; tokens_out: number | null }[]>`select seq, kind, name, input, output, duration_ms, tokens_in, tokens_out from run_steps where run_id = ${id} order by seq`;
  return { ...r, steps };
}

export async function unenrichedSectorSuppliers(limit = 20) {
  return sql<{ id: string; name_ar: string | null; name_en: string | null; city_en: string | null; detective_status: string; n: number }[]>`
    select s.id, s.name_ar, s.name_en, s.city_en, s.detective_status, count(*)::int as n
    from suppliers s join capabilities c on c.supplier_id = s.id
    where s.in_tarmeez and s.detective_status = 'pending' and (c.hs6 like '8481%' or c.hs6 like '8413%' or c.hs6 like '7307%')
    group by s.id order by n desc, s.id limit ${limit}`;
}
```

- [ ] **Step 4: Run the test to verify it passes, then commit**

Run: `perl -e 'alarm 120; exec @ARGV' bun test apps/web/test/queries.test.ts && bun run typecheck:web`
Expected: PASS, five tests.

```bash
git add apps/web/lib/queries.ts apps/web/test/queries.test.ts
git commit -m "feat(web): typed read queries for ledger, suppliers, evidence and runs"
```

---

### Task 3: The gap ledger and the pooled-order page

**Files:**
- Create: `apps/web/components/ui.tsx`, `apps/web/app/page.tsx` (replace), `apps/web/app/orders/[id]/page.tsx`

- [ ] **Step 1: Write the shared primitives**

`apps/web/components/ui.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { classLabel, fmtInt, fmtMoney, fmtPct } from "@/lib/format";

export const Money = ({ v }: { v: number | null | undefined }) => <span className="mono">{fmtMoney(v)}</span>;
export const Int = ({ v }: { v: number | null | undefined }) => <span className="mono">{fmtInt(v)}</span>;
export const Pct = ({ v }: { v: number | null | undefined }) => <span className="mono">{fmtPct(v)}</span>;

const TIER_LABEL: Record<number, string> = { 1: "Tier 1, third-party verified", 2: "Tier 2, official registry", 3: "Tier 3, self-published", 4: "Tier 4, inferred" };
export const Tier = ({ t }: { t: number | null | undefined }) => t ? <span title={TIER_LABEL[t]} className="mono rounded px-1.5 py-0.5 text-xs" style={{ background: t <= 2 ? "#dff1e3" : "#f3ead6", color: "#14110f" }}>T{t}</span> : <span className="text-xs" style={{ color: "var(--muted)" }}>no evidence</span>;

export const Verdict = ({ v }: { v: string }) => {
  const c = v === "supported" ? "#1f7a3a" : v === "refuted" ? "#b3261e" : "var(--muted)";
  return <span className="text-xs font-medium uppercase tracking-wide" style={{ color: c }}>{v}</span>;
};

export const ClassBadge = ({ c }: { c: string }) => <span className="rounded border px-1.5 py-0.5 text-xs" style={{ borderColor: "var(--line)" }}>{classLabel(c)}</span>;

export const GapKind = ({ k }: { k: string | null }) => {
  const label = k === "covered" ? "covered" : k === "manufacturing_gap" ? "manufacturing gap" : k === "supply_gap" ? "supply gap" : "unmatched";
  const color = k === "covered" ? "#1f7a3a" : k === "manufacturing_gap" ? "var(--accent)" : k === "supply_gap" ? "#b3261e" : "var(--muted)";
  return <span className="text-xs font-medium uppercase tracking-wide" style={{ color }}>{label}</span>;
};

export const Registry = ({ tarmeez, mlcp, mis, source }: { tarmeez: boolean; mlcp: boolean; mis: boolean; source: string }) => (
  <span className="flex flex-wrap gap-1 text-xs">
    {tarmeez && <span className="rounded px-1.5 py-0.5" style={{ background: "#ebe6dc" }}>Tarmeez</span>}
    {mlcp && <span className="rounded px-1.5 py-0.5" style={{ background: "#ebe6dc" }}>MLCP</span>}
    {mis && <span className="rounded px-1.5 py-0.5" style={{ background: "#dff1e3" }}>Made in Saudi</span>}
    {!tarmeez && <span className="rounded px-1.5 py-0.5" style={{ background: "#fde4d8", color: "var(--accent)" }}>{source === "hunt" ? "found by KAMIN" : "outside Tarmeez"}</span>}
  </span>
);

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded border" style={{ borderColor: "var(--line)" }}>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className = "" }: { children: ReactNode; className?: string }) => <td className={`border-t px-3 py-2 align-top ${className}`} style={{ borderColor: "var(--line)" }}>{children}</td>;
export const A = ({ href, children }: { href: string; children: ReactNode }) => <Link href={href} className="underline decoration-dotted underline-offset-2">{children}</Link>;
export const Ar = ({ s }: { s: string | null | undefined }) => (s ? <span dir="auto">{s}</span> : null);
```

- [ ] **Step 2: Write the ledger page**

`apps/web/app/page.tsx`:

```tsx
import Link from "next/link";
import { ledger, stats, type GapKind } from "@/lib/queries";
import { A, GapKind as Kind, Int, Money, Table, Td } from "@/components/ui";

export const dynamic = "force-dynamic";
const KINDS: { key: GapKind | "all"; label: string }[] = [{ key: "manufacturing_gap", label: "Manufacturing gaps" }, { key: "supply_gap", label: "Supply gaps" }, { key: "covered", label: "Covered" }, { key: "all", label: "All pooled orders" }];

export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind = "manufacturing_gap" } = await searchParams;
  const k = (KINDS.some((x) => x.key === kind) ? kind : "manufacturing_gap") as GapKind | "all";
  const [rows, s] = await Promise.all([ledger(k), stats()]);
  const total = rows.reduce((a, r) => a + (r.annual_value_usd ?? 0), 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold">Gap ledger</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}><Int v={s.suppliers} /> suppliers on the map, <Int v={s.investigated} /> investigated, <Int v={s.supported} /> supported capabilities, <Int v={s.refuted} /> refuted, <Int v={s.discovered} /> found outside Tarmeez.</p>
      </div>
      <nav className="flex gap-2 text-sm">{KINDS.map((x) => <Link key={x.key} href={`/?kind=${x.key}`} className="rounded px-3 py-1" style={{ background: x.key === k ? "var(--ink)" : "#ebe6dc", color: x.key === k ? "var(--paper)" : "var(--ink)" }}>{x.label}</Link>)}</nav>
      <p className="text-sm" style={{ color: "var(--muted)" }}>{rows.length} pooled orders worth <Money v={total} /> a year. A manufacturing gap has no supported manufacturer or assembler; a supply gap has no supported supplier of any class.</p>
      <Table head={["Pooled order", "HS", "Portcos", "Lines", "Annual qty", "Annual value", "Mandatory", "Kind", "Supported", "Pivots"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <Td><A href={`/orders/${r.id}`}>{r.title}</A>{r.headline && <div className="text-xs" style={{ color: "var(--muted)" }}>{r.headline}</div>}</Td>
            <Td className="mono">{r.hs6}</Td>
            <Td><Int v={r.portco_count} /></Td>
            <Td><Int v={r.line_count} /></Td>
            <Td><Int v={r.qty_annual} /> {r.qty_unit}</Td>
            <Td><Money v={r.annual_value_usd} /></Td>
            <Td>{r.mandatory ? <span style={{ color: "var(--accent)" }}>2027 tranche</span> : "no"}</Td>
            <Td><Kind k={r.gap_kind} /></Td>
            <Td><Int v={r.supported_count} /></Td>
            <Td>{r.pivots ?? "-"}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Write the order page**

`apps/web/app/orders/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { orderDetail } from "@/lib/queries";
import { A, Ar, ClassBadge, GapKind, Int, Money, Pct, Table, Td, Tier, Verdict } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await orderDetail(id);
  if (!o) notFound();
  const env = o.spec_envelope as Record<string, string | number | null>;
  const gc = o.gap_case as { headline?: string; why_now?: string; regulatory_pressure?: string; raw_materials?: string; recommended_next_step?: string; pivot_candidates?: { supplier_id: string; supplier_name: string; why: string; what_they_have: string; what_is_missing: string }[] } | null;
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Pooled order <span className="mono">HS {o.hs6}</span></div>
        <h1 className="text-2xl font-semibold">{o.title}</h1>
        <p className="mt-1 text-sm"><GapKind k={o.gap_kind} /> · <Int v={o.portco_count} /> portfolio companies · <Int v={o.qty_now} /> {o.qty_unit} now, <Int v={o.qty_annual} /> a year · <Money v={o.annual_value_usd} /> a year · national imports 2024 <Money v={o.import_value_usd} />{o.mandatory ? " · on the announced Mandatory List tranche (1 August 2027)" : ""}</p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>Envelope: {Object.entries(env).filter(([, v]) => v !== null && v !== "").map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(" · ")}</p>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">The lines that became this order</h2>
        <Table head={["Company", "System", "As written", "Qty", "Annual factor", "Annual value", "Anchor", "Confidence", "Run"]}>
          {o.lines.map((l) => (
            <tr key={l.id}>
              <Td>{l.portco}</Td><Td className="text-xs">{l.source_system}</Td><Td><Ar s={l.raw_text} /></Td><Td><Int v={l.qty} /> {l.qty_unit}</Td><Td>×<Int v={l.history_factor} /></Td><Td><Money v={l.annual_value_usd} /></Td><Td className="mono">{l.hs6}</Td><Td><Pct v={l.confidence} /></Td><Td>{l.run_id && <A href={`/runs/${l.run_id}`}>trajectory</A>}</Td>
            </tr>
          ))}
        </Table>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Who could serve it</h2>
        {o.matches.length === 0 && <p className="text-sm" style={{ color: "var(--muted)" }}>No capability under this heading on the map. This is a supply gap.</p>}
        {o.matches.length > 0 && (
          <Table head={["Rank", "Supplier", "Region", "Product", "Class", "Verdict", "Evidence", "Confidence", "Score", "Share"]}>
            {o.matches.map((m) => (
              <tr key={m.capability_id}>
                <Td className="mono">{m.rank}</Td>
                <Td><A href={`/suppliers/${m.supplier_id}`}>{m.supplier_name}</A>{m.in_made_in_saudi && <span className="ml-1 text-xs" style={{ color: "#1f7a3a" }}>Made in Saudi</span>}</Td>
                <Td className="text-xs">{m.region}</Td>
                <Td><A href={`/evidence/${m.capability_id}`}>{m.product}</A></Td>
                <Td><ClassBadge c={m.class} /></Td>
                <Td><Verdict v={m.verdict} /></Td>
                <Td><Tier t={m.best_tier} /></Td>
                <Td><Pct v={m.confidence} /></Td>
                <Td className="mono">{m.score.toFixed(3)}</Td>
                <Td><Pct v={m.share} /></Td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      {gc && (
        <section className="rounded border p-4" style={{ borderColor: "var(--accent)" }}>
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--accent)" }}>Investment case, written by the Advisor</div>
          <h2 className="text-lg font-semibold">{gc.headline}</h2>
          <p className="mt-1 text-sm">{gc.why_now}</p>
          <p className="mt-1 text-sm"><span className="font-medium">Regulatory pressure:</span> {gc.regulatory_pressure}</p>
          <p className="mt-1 text-sm"><span className="font-medium">Raw materials:</span> {gc.raw_materials}</p>
          {gc.pivot_candidates && gc.pivot_candidates.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-sm font-medium">Who could pivot into it</div>
              <ul className="space-y-1 text-sm">{gc.pivot_candidates.map((p) => <li key={p.supplier_id}><A href={`/suppliers/${p.supplier_id}`}>{p.supplier_name}</A>: {p.why} <span style={{ color: "var(--muted)" }}>Has: {p.what_they_have}. Missing: {p.what_is_missing}.</span></li>)}</ul>
            </div>
          )}
          <p className="mt-3 text-sm"><span className="font-medium">Next step:</span> {gc.recommended_next_step}</p>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck, run the dev server once and load both pages**

Run: `bun run typecheck:web && (bun run web:dev > /tmp/kamin-web.log 2>&1 &) && sleep 8 && curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/ && curl -s http://localhost:3000/ | grep -c "Gap ledger"`
Expected: typecheck clean; HTTP 200; the page contains the heading. Stop the dev server afterwards with `pkill -f "next dev"`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui.tsx apps/web/app/page.tsx "apps/web/app/orders/[id]/page.tsx"
git commit -m "feat(web): gap ledger and pooled-order pages"
```

---

### Task 4: The capability view and the supplier page

**Files:**
- Create: `apps/web/app/suppliers/page.tsx`, `apps/web/app/suppliers/[id]/page.tsx`

- [ ] **Step 1: Write the list page**

`apps/web/app/suppliers/page.tsx`:

```tsx
import { supplierList } from "@/lib/queries";
import { A, Ar, ClassBadge, Int, Registry, Table, Td } from "@/components/ui";

export const dynamic = "force-dynamic";
const FAMILIES = ["valve", "pump", "fitting"], CLASSES = ["manufacturer", "assembler", "authorised_distributor", "trader"], VERDICTS = ["supported", "pending", "refuted"], REGISTRIES = [["tarmeez", "Tarmeez"], ["mlcp", "MLCP"], ["made_in_saudi", "Made in Saudi"], ["discovered", "Outside Tarmeez"]];

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const f = await searchParams;
  const rows = await supplierList({ family: f.family, region: f.region, cls: f.cls, verdict: f.verdict, registry: f.registry, q: f.q });
  const Sel = ({ name, options, label }: { name: string; options: string[][]; label: string }) => (
    <label className="text-xs" style={{ color: "var(--muted)" }}>{label}
      <select name={name} defaultValue={f[name] ?? ""} className="ml-1 rounded border bg-transparent px-1 py-0.5 text-sm" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
        <option value="">any</option>{options.map(([v, l]) => <option key={v} value={v}>{l ?? v}</option>)}
      </select>
    </label>
  );
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Capabilities in the valve, pump and fitting slice</h1>
      <form className="flex flex-wrap items-end gap-3 text-sm">
        <Sel name="family" label="Family" options={FAMILIES.map((x) => [x, x])} />
        <Sel name="cls" label="Class" options={CLASSES.map((x) => [x, x.replace(/_/g, " ")])} />
        <Sel name="verdict" label="Verdict" options={VERDICTS.map((x) => [x, x])} />
        <Sel name="registry" label="Registry" options={REGISTRIES} />
        <label className="text-xs" style={{ color: "var(--muted)" }}>Name or CR <input name="q" defaultValue={f.q ?? ""} className="ml-1 rounded border bg-transparent px-2 py-0.5 text-sm" style={{ borderColor: "var(--line)" }} /></label>
        <button className="rounded px-3 py-1 text-sm" style={{ background: "var(--ink)", color: "var(--paper)" }}>Filter</button>
      </form>
      <p className="text-sm" style={{ color: "var(--muted)" }}>{rows.length} suppliers, ordered by supported capabilities.</p>
      <Table head={["Supplier", "City", "Region", "Registries", "Investigated", "Capabilities", "Supported", "Best class"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <Td><A href={`/suppliers/${r.id}`}>{r.name_en ?? r.id}</A><div className="text-xs" style={{ color: "var(--muted)" }}><Ar s={r.name_ar} /></div></Td>
            <Td className="text-xs">{r.city_en}</Td><Td className="text-xs">{r.region_en}</Td>
            <Td><Registry tarmeez={r.in_tarmeez} mlcp={r.in_mlcp} mis={r.in_made_in_saudi} source={r.source} /></Td>
            <Td className="text-xs">{r.detective_status}</Td><Td><Int v={r.capability_count} /></Td><Td><Int v={r.supported_count} /></Td><Td>{r.best_class && <ClassBadge c={r.best_class} />}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Write the supplier page**

`apps/web/app/suppliers/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { supplierDetail } from "@/lib/queries";
import { A, Ar, ClassBadge, Int, Pct, Registry, Table, Td, Tier, Verdict } from "@/components/ui";
import { ColdMiss } from "@/components/ColdMiss";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await supplierDetail(decodeURIComponent(id));
  if (!s) notFound();
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Supplier <span className="mono">{s.id}</span>{s.cr_number && <> · CR <span className="mono">{s.cr_number}</span></>}</div>
        <h1 className="text-2xl font-semibold">{s.name_en ?? s.name_ar}</h1>
        <div className="text-sm" style={{ color: "var(--muted)" }}><Ar s={s.name_ar} /> · {s.city_en}{s.region_en ? `, ${s.region_en}` : ""}{s.investment_type ? ` · ${s.investment_type}` : ""}{s.website && <> · <a className="underline" href={s.website} target="_blank" rel="noreferrer">{s.website}</a></>}</div>
        <div className="mt-2"><Registry tarmeez={s.in_tarmeez} mlcp={s.in_mlcp} mis={s.in_made_in_saudi} source={s.source} /></div>
        {s.summary && <p className="mt-2 max-w-3xl text-sm">{s.summary}</p>}
      </div>
      {s.detective_status === "pending" && <ColdMiss supplierId={s.id} />}
      <section>
        <h2 className="mb-2 font-semibold">Capabilities ({s.capabilities.length})</h2>
        <Table head={["Product", "HS", "Class", "Verdict", "Confidence", "Evidence", "Best tier", "Origin", "Declared capacity"]}>
          {s.capabilities.map((c) => (
            <tr key={c.id}>
              <Td><A href={`/evidence/${c.id}`}>{c.product}</A>{c.product_ar && <div className="text-xs" style={{ color: "var(--muted)" }}><Ar s={c.product_ar} /></div>}</Td>
              <Td className="mono">{c.hs6}</Td><Td><ClassBadge c={c.class} /></Td><Td><Verdict v={c.verdict} /></Td><Td><Pct v={c.confidence} /></Td><Td><Int v={c.evidence_count} /></Td><Td><Tier t={c.best_tier} /></Td><Td className="text-xs">{c.origin}</Td><Td>{c.declared_amount ? <><Int v={c.declared_amount} /> {c.declared_unit}/yr</> : "-"}</Td>
            </tr>
          ))}
        </Table>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Runs on this supplier ({s.runs.length})</h2>
        <Table head={["Role", "Status", "Model", "Started", "Seconds", ""]}>
          {s.runs.map((r) => <tr key={r.id}><Td>{r.role}</Td><Td>{r.status}</Td><Td className="mono text-xs">{r.model}</Td><Td className="text-xs">{r.started_at.slice(0, 19)}</Td><Td className="mono">{r.seconds?.toFixed(0) ?? "-"}</Td><Td><A href={`/runs/${r.id}`}>trajectory</A></Td></tr>)}
        </Table>
      </section>
    </div>
  );
}
```

`ColdMiss` arrives in Task 6; create `apps/web/components/ColdMiss.tsx` now as a placeholder that renders the button disabled: `"use client"; export function ColdMiss({ supplierId }: { supplierId: string }) { return <p className="text-sm">Live investigation for {supplierId} arrives in Task 6.</p>; }`

- [ ] **Step 3: Typecheck and commit**

```bash
bun run typecheck:web
git add apps/web/app/suppliers apps/web/components/ColdMiss.tsx
git commit -m "feat(web): capability view and supplier page"
```

---

### Task 5: Evidence drill-down and run trajectory

**Files:**
- Create: `apps/web/app/evidence/[id]/page.tsx`, `apps/web/app/runs/[id]/page.tsx`

- [ ] **Step 1: Write the evidence page**

`apps/web/app/evidence/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { capabilityDetail } from "@/lib/queries";
import { A, Ar, ClassBadge, Pct, Table, Td, Tier, Verdict } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await capabilityDetail(id);
  if (!c) notFound();
  const lenses = c.lenses as { analysis?: string; real?: { verdict: string; reasoning: string; killer_evidence: string | null }; at_spec?: { verdict: string; reasoning: string }; local?: { class: string; reasoning: string } } | null;
  const signals = [c.in_made_in_saudi && "Made in Saudi certified", c.mandatory && "heading on the announced Mandatory List tranche", c.cr_number && "commercial registration on record", c.in_tarmeez && "declared in Tarmeez", c.in_mlcp && "listed by the Madinah chamber"].filter(Boolean) as string[];
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Capability · <A href={`/suppliers/${c.supplier_id}`}>{c.supplier_name}</A> <Ar s={c.supplier_name_ar} /></div>
        <h1 className="text-2xl font-semibold">{c.product} <span className="mono text-base" style={{ color: "var(--muted)" }}>HS {c.hs6}</span></h1>
        <p className="mt-1 text-sm"><ClassBadge c={c.class} /> · <Verdict v={c.verdict} /> · confidence <Pct v={c.confidence} /> · origin {c.origin}{c.declared_amount ? ` · declared ${c.declared_amount} ${c.declared_unit ?? ""} a year` : ""}</p>
        {Object.keys(c.spec_attrs ?? {}).length > 0 && <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>Stated: {Object.entries(c.spec_attrs).map(([k, v]) => `${k} ${v}`).join(" · ")}</p>}
      </div>
      <section>
        <h2 className="mb-2 font-semibold">Evidence chain ({c.evidence.length})</h2>
        <p className="mb-2 text-xs" style={{ color: "var(--muted)" }}>Tier 1 third-party verified · Tier 2 official registry · Tier 3 self-published · Tier 4 inferred. A capability counts toward coverage only when supported and backed by Tier 1 or 2.</p>
        <Table head={["Tier", "Kind", "Source", "Excerpt", "Run"]}>
          {c.evidence.map((e) => <tr key={e.id}><Td><Tier t={e.tier} /></Td><Td className="text-xs">{e.source_type}</Td><Td className="text-xs"><a className="underline" href={e.source_url} target="_blank" rel="noreferrer">{e.title ?? e.source_url.slice(0, 60)}</a></Td><Td className="text-sm"><Ar s={e.excerpt} /></Td><Td>{e.run_id && <A href={`/runs/${e.run_id}`}>trajectory</A>}</Td></tr>)}
        </Table>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded border p-4" style={{ borderColor: "var(--line)" }}>
          <h2 className="mb-2 font-semibold">Auditor verdict</h2>
          {!lenses && <p className="text-sm" style={{ color: "var(--muted)" }}>Not audited yet.</p>}
          {lenses && (
            <dl className="space-y-2 text-sm">
              {lenses.analysis && <div><dt className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Working notes</dt><dd>{lenses.analysis}</dd></div>}
              <div><dt className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Is it real</dt><dd><Verdict v={lenses.real?.verdict ?? "unknown"} /> {lenses.real?.reasoning}{lenses.real?.killer_evidence && <span className="block" style={{ color: "#b3261e" }}>Killer evidence: {lenses.real.killer_evidence}</span>}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Is it at specification</dt><dd><Verdict v={lenses.at_spec?.verdict ?? "unknown"} /> {lenses.at_spec?.reasoning}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>How local</dt><dd>{lenses.local && <ClassBadge c={lenses.local.class} />} {lenses.local?.reasoning}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Auditor's own confidence</dt><dd><Pct v={c.class_confidence} /></dd></div>
            </dl>
          )}
        </div>
        <div className="rounded border p-4" style={{ borderColor: "var(--line)" }}>
          <h2 className="mb-2 font-semibold">Local content signals</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">{signals.length ? signals.map((s) => <li key={s}>{s}</li>) : <li>none beyond the class</li>}</ul>
          <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>The LCGPA G1 score is computed only from a supplier's declared inputs (Saudi salaries, local procurement, local assets, capability building) and never from class. No inputs on record for this supplier, so no score is shown. Methodology: G1 Baseline Template N.1.</p>
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Runs behind this claim</h2>
        <Table head={["Role", "Status", "Model", "Started", "Seconds", ""]}>
          {c.runs.map((r) => <tr key={r.id}><Td>{r.role}</Td><Td>{r.status}</Td><Td className="mono text-xs">{r.model}</Td><Td className="text-xs">{r.started_at.slice(0, 19)}</Td><Td className="mono">{r.seconds?.toFixed(0) ?? "-"}</Td><Td><A href={`/runs/${r.id}`}>trajectory</A></Td></tr>)}
        </Table>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Write the run page**

`apps/web/app/runs/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { runDetail } from "@/lib/queries";
import { Table, Td } from "@/components/ui";

export const dynamic = "force-dynamic";
const compact = (v: unknown) => { const s = typeof v === "string" ? v : JSON.stringify(v, null, 1); return s && s.length > 1200 ? s.slice(0, 1200) + " …" : s; };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await runDetail(id);
  if (!r) notFound();
  const tokens = r.steps.reduce((s, x) => s + (x.tokens_in ?? 0) + (x.tokens_out ?? 0), 0);
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Run <span className="mono">{r.id}</span></div>
        <h1 className="text-2xl font-semibold">{r.role} on <span className="mono">{r.model}</span></h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>{r.status}{r.error ? `: ${r.error}` : ""} · input <span className="mono">{r.input_ref}</span> · {r.started_at.slice(0, 19)} · {r.steps.length} steps · {tokens} tokens</p>
      </div>
      <Table head={["#", "Kind", "Step", "ms", "Tokens", "Input", "Output"]}>
        {r.steps.map((s) => <tr key={s.seq}><Td className="mono">{s.seq}</Td><Td className="text-xs">{s.kind}</Td><Td>{s.name}</Td><Td className="mono">{s.duration_ms ?? "-"}</Td><Td className="mono text-xs">{s.tokens_in ? `${s.tokens_in}→${s.tokens_out ?? 0}` : "-"}</Td><Td><pre className="max-w-md whitespace-pre-wrap text-xs">{compact(s.input)}</pre></Td><Td><pre className="max-w-lg whitespace-pre-wrap text-xs">{compact(s.output)}</pre></Td></tr>)}
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and commit**

```bash
bun run typecheck:web
git add apps/web/app/evidence apps/web/app/runs
git commit -m "feat(web): evidence drill-down with auditor lenses and run trajectories"
```

---

### Task 6: The live cold miss and its recording

**Files:**
- Create: `apps/web/app/api/cold-miss/[supplierId]/route.ts`, `apps/web/components/ColdMiss.tsx` (replace), `packages/core/scripts/record-cold-miss.ts`
- Test: `packages/core/test/cold-miss.test.ts`

**Interfaces:**
- Produces: `coldMiss(db, supplierId, sink): Promise<{ detective: { runId: string; merged: {...} }; audits: { capabilityId: string; verdict: string; class: string }[] }>` in `packages/core/src/coldmiss.ts` (runs the Detective, then the Auditor on every sector capability of that supplier, emitting lines to the sink); the route streams `data: <line>` events and a final `event: done` with the JSON summary; the recording script writes `apps/web/public/cold-miss/<id>.json` as `{ supplierId, recordedAt, events: { t: number; line: string }[] }`.

- [ ] **Step 1: Write the failing test**

`packages/core/test/cold-miss.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { coldMiss } from "../src/coldmiss";
import { ollamaUp } from "../src/models/registry";

describe.skipIf(!process.env.DATABASE_URL || !process.env.TAVILY_API_KEY || !(await ollamaUp()))("coldMiss live", () => {
  test("investigates and audits one pending Tarmeez supplier, streaming lines to the sink", async () => {
    const [s] = await sql<{ id: string }[]>`select s.id from suppliers s join capabilities c on c.supplier_id = s.id where s.in_tarmeez and s.detective_status = 'pending' and c.hs6 like '8481%' order by s.id limit 1`;
    if (!s) return;
    const lines: string[] = [];
    const r = await coldMiss(sql, s.id, (l) => lines.push(l));
    expect(lines.some((l) => l.startsWith("▶ run"))).toBe(true);
    expect(r.audits.length).toBeGreaterThanOrEqual(0);
    const [row] = await sql<{ detective_status: string }[]>`select detective_status from suppliers where id = ${s.id}`;
    expect(row!.detective_status).toBe("ok");
  }, 600_000);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/cold-miss.test.ts`
Expected: FAIL with "Cannot find module '../src/coldmiss'".

- [ ] **Step 3: Implement the core function, the route, the component and the recorder**

`packages/core/src/coldmiss.ts`:

```ts
import type { Sql } from "postgres";
import { runAuditor } from "./auditor/run";
import { runDetective } from "./detective/run";

export async function coldMiss(db: Sql, supplierId: string, sink: (line: string) => void) {
  sink(`▷ cold miss: ${supplierId} has only declared capabilities. Investigating.`);
  const detective = await runDetective(db, supplierId, { sink });
  const caps = await db<{ id: string; hs6: string; product: string | null }[]>`
    select c.id, c.hs6, coalesce(c.product_title, p.title_en) as product from capabilities c left join products p on p.tariff_code = c.tariff_code
    where c.supplier_id = ${supplierId} and (c.hs6 like '8481%' or c.hs6 like '8413%' or c.hs6 like '7307%') order by c.hs6 limit 3`;
  sink(`▷ auditing ${caps.length} capabilities in the slice`);
  const audits: { capabilityId: string; verdict: string; class: string }[] = [];
  for (const c of caps) {
    const r = await runAuditor(db, c.id, { sink });
    audits.push({ capabilityId: c.id, verdict: r.verdict, class: r.class });
    sink(`▷ ${c.product ?? c.hs6}: ${r.verdict}, ${r.class.replace(/_/g, " ")}, confidence ${r.confidence}`);
  }
  sink(`▷ done: ${detective.merged.evidence} evidence records, ${audits.length} verdicts written to the map`);
  return { detective: { runId: detective.runId, merged: detective.merged }, audits };
}
```

`apps/web/app/api/cold-miss/[supplierId]/route.ts`:

```ts
import { coldMiss } from "@kamin/core/src/coldmiss";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function GET(_req: Request, { params }: { params: Promise<{ supplierId: string }> }) {
  const { supplierId } = await params;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: string) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(line)}\n\n`));
      try {
        const result = await coldMiss(sql, decodeURIComponent(supplierId), send);
        controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify(result)}\n\n`));
      } catch (err) {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify((err as Error).message)}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
```

`apps/web/components/ColdMiss.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";

type Rec = { supplierId: string; recordedAt: string; events: { t: number; line: string }[] };

export function ColdMiss({ supplierId }: { supplierId: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "live" | "recording" | "done" | "error">("idle");
  const [hasRecording, setHasRecording] = useState(false);
  const box = useRef<HTMLPreElement>(null);
  useEffect(() => { fetch(`/cold-miss/${encodeURIComponent(supplierId)}.json`, { method: "HEAD" }).then((r) => setHasRecording(r.ok)).catch(() => {}); }, [supplierId]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [lines]);

  const live = () => {
    setLines([]); setState("live");
    const es = new EventSource(`/api/cold-miss/${encodeURIComponent(supplierId)}`);
    es.onmessage = (e) => setLines((l) => [...l, JSON.parse(e.data)]);
    es.addEventListener("done", () => { es.close(); setState("done"); setTimeout(() => location.reload(), 1500); });
    es.addEventListener("error", (e) => { es.close(); setLines((l) => [...l, `error: ${(e as MessageEvent).data ?? "stream closed"}`]); setState("error"); });
  };
  const play = async () => {
    setLines([]); setState("recording");
    const rec = (await (await fetch(`/cold-miss/${encodeURIComponent(supplierId)}.json`)).json()) as Rec;
    let last = 0;
    for (const ev of rec.events) { await new Promise((r) => setTimeout(r, Math.min(1500, (ev.t - last) / 4))); last = ev.t; setLines((l) => [...l, ev.line]); }
    setState("done");
  };
  return (
    <section className="rounded border p-4" style={{ borderColor: "var(--accent)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--accent)" }}>Cold miss</div>
          <p className="text-sm">This supplier is on the map with declared capabilities only. Run the Detective and the Auditor now and watch the evidence, the class and the verdict write themselves onto this node.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={live} disabled={state === "live" || state === "recording"} className="rounded px-3 py-1 text-sm" style={{ background: "var(--accent)", color: "white" }}>Investigate live</button>
          {hasRecording && <button onClick={play} disabled={state === "live" || state === "recording"} className="rounded border px-3 py-1 text-sm" style={{ borderColor: "var(--line)" }}>Play recording</button>}
        </div>
      </div>
      {lines.length > 0 && <pre ref={box} className="mono mt-3 max-h-80 overflow-auto rounded p-3 text-xs" style={{ background: "var(--ink)", color: "#e9e4da" }}>{lines.join("\n")}</pre>}
      {state === "done" && <p className="mt-2 text-sm" style={{ color: "#1f7a3a" }}>Written to the graph. Reloading.</p>}
    </section>
  );
}
```

`packages/core/scripts/record-cold-miss.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "../src/db/client";
import { coldMiss } from "../src/coldmiss";
import { REPO_ROOT } from "../src/paths";

const id = process.argv[2];
if (!id) { console.error("usage: bun run record-cold-miss <supplierId>"); process.exit(1); }
const t0 = Date.now();
const events: { t: number; line: string }[] = [];
await coldMiss(sql, id, (line) => { events.push({ t: Date.now() - t0, line }); console.log(line); });
const dir = join(REPO_ROOT, "apps/web/public/cold-miss");
await mkdir(dir, { recursive: true });
await writeFile(join(dir, `${id}.json`), JSON.stringify({ supplierId: id, recordedAt: new Date().toISOString(), events }, null, 1));
console.log(`recorded ${events.length} lines in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
await sql.end();
```

Root script: `"record-cold-miss": "bun run packages/core/scripts/record-cold-miss.ts"`.

- [ ] **Step 4: Run the live test, record one cold miss, verify the route streams**

Run: `perl -e 'alarm 700; exec @ARGV' bun test packages/core/test/cold-miss.test.ts && bun run typecheck && bun run typecheck:web`
Expected: PASS (several minutes on the local model).

Then pick a second pending supplier for the stage and record it: `bun run record-cold-miss tarmeez:<id>` writes `apps/web/public/cold-miss/tarmeez:<id>.json`. The supplier recorded is no longer pending, so the demo uses a *third* pending supplier for the live path and the recorded one for playback; note both ids in `docs/demo-runbook.md`.

Start the dev server and open `/api/cold-miss/<a pending id>` with curl to see `data:` lines arrive progressively.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/coldmiss.ts packages/core/scripts/record-cold-miss.ts packages/core/test/cold-miss.test.ts apps/web/app/api apps/web/components/ColdMiss.tsx apps/web/public/cold-miss package.json
git commit -m "feat: live cold miss streamed as server-sent events, with a recorded fallback"
```

---

### Task 7: Snapshot, numbers, runbook, Langfuse compose, final verification

**Files:**
- Create: `packages/core/scripts/db-snapshot.ts`, `packages/core/scripts/db-restore.ts`, `docker-compose.langfuse.yml`, `docs/numbers.md`, `docs/demo-runbook.md`
- Modify: root `package.json`, `packages/core/README.md`, `FACTS.md`, `BUILD_PLAN.md`

- [ ] **Step 1: Snapshot and restore**

`packages/core/scripts/db-snapshot.ts`:

```ts
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { REPO_ROOT } from "../src/paths";

const dir = join(REPO_ROOT, "data/snapshots");
await mkdir(dir, { recursive: true });
const file = join(dir, `kamin-${new Date().toISOString().slice(0, 10)}.sql.gz`);
const proc = Bun.spawn(["sh", "-c", `docker exec kamin-db pg_dump -U kamin -d kamin --no-owner | gzip > "${file}"`], { stdout: "inherit", stderr: "inherit" });
if ((await proc.exited) !== 0) throw new Error("pg_dump failed");
console.log(`snapshot written: ${file}`);
```

`packages/core/scripts/db-restore.ts`:

```ts
const file = process.argv[2];
if (!file) { console.error("usage: bun run db:restore <snapshot.sql.gz>"); process.exit(1); }
const proc = Bun.spawn(["sh", "-c", `gunzip -c "${file}" | docker exec -i kamin-db psql -U kamin -d kamin -q`], { stdout: "inherit", stderr: "inherit" });
if ((await proc.exited) !== 0) throw new Error("restore failed");
console.log("restored");
```

Root scripts: `"db:snapshot": "bun run packages/core/scripts/db-snapshot.ts"`, `"db:restore": "bun run packages/core/scripts/db-restore.ts"`. Add `data/snapshots/` to `.gitignore`.

- [ ] **Step 2: Langfuse compose, kept for when disk allows**

`docker-compose.langfuse.yml` with the official self-host services (langfuse-web on 3001, langfuse-worker, its own postgres, clickhouse, redis, minio), `NEXTAUTH_SECRET`, `SALT` and `ENCRYPTION_KEY` read from `.env`, and a comment at the top: "Not started by default; needs about four gigabytes of images. Run `docker compose -f docker-compose.langfuse.yml up -d` when disk allows, then set LANGFUSE_* in .env and add the Langfuse callback handler beside the trajectory handler."

- [ ] **Step 3: The numbers document and the runbook**

`docs/numbers.md`: a table with every number the demo says out loud, its value as measured, and the SQL or script that produces it: suppliers on the map, capabilities, evidence by tier, investigated suppliers, supported and refuted verdicts, pooled orders and their annual value, coverage and line coverage, manufacturing and supply gaps, discovery lift, Comtrade totals for the three headings, seconds per Coordinator, Detective and Auditor run, and the two Tarmeez counts against the deliverables' old figures, with the reconciliation note.

`docs/demo-runbook.md`: prerequisites (Docker up, Ollama up with both models, `.env`), the two commands (`bun run db:up`, `bun run demo`), the seven demo steps from BUILD_PLAN mapped to URLs, the recorded and the live cold-miss supplier ids, what to say if the network fails, and how to restore the snapshot.

- [ ] **Step 4: Final verification**

Run: `bun run typecheck && bun run typecheck:web && perl -e 'alarm 900; exec @ARGV' bun test packages/core/test apps/web/test && bun run web:build`
Expected: both typechecks clean, all tests pass or skip, the production build completes.

- [ ] **Step 5: Commit and record**

```bash
git add packages/core/scripts/db-snapshot.ts packages/core/scripts/db-restore.ts docker-compose.langfuse.yml docs/numbers.md docs/demo-runbook.md package.json .gitignore packages/core/README.md FACTS.md BUILD_PLAN.md
git commit -m "feat: snapshot and restore, numbers document, demo runbook, Langfuse compose"
```

---

## Self-review

**Spec coverage.** BUILD_PLAN UI screens 1 to 3 with the coverage header, Tasks 3 to 5; demo steps 2 to 5 map to the ledger, the order page, the supplier page and the evidence page; step 6, the cold miss on a known supplier, Task 6 with its recorded fallback; Hour 40 to 48 snapshot freeze and number reconciliation, Task 7; Langfuse deferred until disk allows, Task 7 keeps the compose file ready. The global disclosure sits in the layout footer on every screen. Nothing in the app writes to the graph except the cold-miss route, which calls the milestone-2 runs unchanged.

**Placeholder scan.** Task 7 steps 2 and 3 describe two documents and one compose file whose contents are the measured numbers and the official Langfuse service list; every other step is full code. The `ColdMiss` placeholder in Task 4 is replaced in Task 6 by design.

**Type consistency.** `coverageSummary`, `ledger`, `orderDetail`, `supplierList`, `supplierDetail`, `capabilityDetail`, `runDetail` and `unenrichedSectorSuppliers` are defined once in `lib/queries.ts` and consumed by the pages with the field names used there; `coldMiss` from core is consumed by the route and the recorder; `withRun`'s `sink` option flows through `runDetective` and `runAuditor`.
