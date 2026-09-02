# KAMIN Milestone 2: Detectives and Auditors, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn declared Tarmeez capabilities in the valve, pump and fitting slice into evidenced, audited, classified capabilities; add MLCP and Made in Saudi as second and third registries joined on CR number; find suppliers no registry lists; and measure the cost and time per supplier that the pitch quotes.

**Architecture:** A Detective run is a scripted investigation, not a free agent: build two searches, run them through Tavily with raw page text, pick the pages that belong to this supplier, fetch what Tavily did not, and make one structured extraction call that returns capabilities with evidence and a class guess. An Auditor run makes one adversarial structured call whose three sections are the three lenses, then maps them to a verdict and a class. Both persist into the existing graph tables plus a few added columns, and every step lands in `runs` and `run_steps` through the milestone-1 handler. The swarm is a resumable script with a small concurrency limit because one Ollama serialises every model call.

**Tech Stack:** As milestone 1, plus Tavily REST (`https://api.tavily.com/search`), Playwright with Chromium for the Made in Saudi capture, and no new database technology.

**Spec:** `BUILD_PLAN.md` (Hour 8 to 16), `CONTEXT.md` (Supplier, Capability, Class, Evidence tier, Verdict, Supported capability, Discovery lift), `docs/adr/0003` and `0004`, `DATA_SOURCES.md` re-test table (Tavily, MLCP, Made in Saudi).

## Global Constraints

- Everything from milestone 1 still holds: TypeScript, names from `CONTEXT.md`, runs never graphs, Ollama first through the registry (`DETECTIVE_MODEL` and `AUDITOR_MODEL` default to `ollama:qwen3.5:9b`), trajectories in Postgres and on the terminal, no em dashes, nothing deleted from the user's disk.
- Tavily is the only web search. At most two searches per Detective run and every response is cached on disk under `data/raw/tavily/` keyed by a hash of the query, so re-runs cost no credits.
- Fetched pages are cached under `data/raw/pages/` keyed by a hash of the URL, capped at 12,000 characters of text each, with a descriptive User-Agent and a 20 second timeout.
- Evidence tiers follow `CONTEXT.md`: certification or award from a third party is 1; a registry or a business directory entry is 2; the supplier's own site, catalogue or news is 3; anything inferred is 4. A Detective never writes tier 4.
- A capability's verdict is `refuted` when the real lens or the at-spec lens refutes it, `supported` when both support it, and stays `pending` otherwise. The local lens only classifies. Being a trader never refutes.
- Scope discipline: the swarm orders suppliers by how many capabilities they hold in the sector headings 8481, 8413 and 7307, takes a limit, and is resumable. Depth over breadth.
- Made in Saudi is captured with a real browser, never by replicating its request signing.
- Every new pure function has a unit test on a saved fixture; every run type has one live test that skips itself when Ollama or the database is unreachable.

---

## File structure

```
packages/core/
  src/db/migrations/0004_enrichment.sql   supplier and capability columns for detective and audit state; nullable tariff codes for found capabilities
  src/web/tavily.ts                       search(query) with disk cache; TavilyResult type
  src/web/fetch.ts                        fetchText(url) with disk cache; htmlToText pure
  src/detective/queries.ts                pure: buildQueries(supplier) -> string[]
  src/detective/select.ts                 pure: selectPages(supplier, results) -> ranked pages, tier by source kind
  src/detective/schema.ts                 zod: DetectiveFindings (strict) and DetectiveFindingsLoose
  src/detective/persist.ts                mergeFindings(db, supplier, findings, runId): creates or enriches capabilities and evidence
  src/detective/run.ts                    runDetective(db, supplierId)
  src/detective/hunt.ts                   runHunt(db, family): discovers suppliers absent from every registry
  src/auditor/schema.ts                   zod: AuditVerdict (strict) and AuditVerdictLoose
  src/auditor/verdict.ts                  pure: lensesToVerdict(lenses, evidenceTiers) -> { verdict, class, confidence }
  src/auditor/run.ts                      runAuditor(db, capabilityId)
  src/mlcp/parse.ts                       pure: parseListPage(html), parseDetailPage(html)
  src/mlcp/ingest.ts                      fetch all pages with cache and upsert suppliers on CR
  src/madeinsaudi/capture.ts              Playwright: paginate the members page, save intercepted API responses
  src/madeinsaudi/load.ts                 match members to suppliers by name, set in_made_in_saudi, write tier-1 evidence
  src/text/names.ts                       pure: normaliseArabic, nameSimilarity
  scripts/ingest-mlcp.ts, scripts/capture-made-in-saudi.ts, scripts/load-made-in-saudi.ts
  scripts/detective.ts <supplierId>       one run, trajectory on the terminal
  scripts/auditor.ts <capabilityId>
  scripts/swarm.ts [--limit N] [--stage detective|auditor|both]
  scripts/hunt.ts
  scripts/cost-report.ts                  tokens, seconds and estimated cost per role
  test/fixtures/mlcp-list-page.html, mlcp-detail.html, tavily-kanoo.json
  test/*.test.ts
```

---

### Task 1: Enrichment columns

**Files:**
- Create: `packages/core/src/db/migrations/0004_enrichment.sql`
- Test: `packages/core/test/enrichment-schema.test.ts`

**Interfaces:**
- Produces: `suppliers.detective_status text default 'pending' check in ('pending','ok','error','skipped')`, `suppliers.detective_run_id uuid`, `suppliers.detective_at timestamptz`, `suppliers.summary text`; `capabilities.tariff_code` nullable, `capabilities.product_title text`, `capabilities.origin text default 'tarmeez'`, `capabilities.class_confidence real`, `capabilities.lenses jsonb`, `capabilities.audit_run_id uuid`, `capabilities.audited_at timestamptz`, partial unique index on `(supplier_id, hs6, lower(product_title))` where `tariff_code is null`; `evidence.run_id uuid`, `evidence.title text`.

- [ ] **Step 1: Write the failing test**

`packages/core/test/enrichment-schema.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";

describe.skipIf(!process.env.DATABASE_URL)("enrichment schema", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from suppliers where id like 'test:%'`;
    await sql`insert into suppliers (id, name_ar, name_en, source) values ('test:m2', 'مورد', 'Supplier', 'test')`;
  });

  test("a found capability needs no tariff code and is unique per supplier, hs6 and title", async () => {
    await sql`insert into capabilities (supplier_id, hs6, product_title, class, origin) values ('test:m2', '848180', 'Ball valves', 'trader', 'detective')`;
    await expect((async () => {
      await sql`insert into capabilities (supplier_id, hs6, product_title, class, origin) values ('test:m2', '848180', 'ball valves', 'trader', 'detective')`;
    })()).rejects.toThrow();
    const [row] = await sql<{ detective_status: string }[]>`select detective_status from suppliers where id = 'test:m2'`;
    expect(row!.detective_status).toBe("pending");
  });

  test("evidence can carry the run that produced it", async () => {
    const [cap] = await sql<{ id: string }[]>`select id from capabilities where supplier_id = 'test:m2' limit 1`;
    const [run] = await sql<{ id: string }[]>`insert into runs (role, input_ref, model) values ('detective', 'test:m2', 'm') returning id`;
    await sql`insert into evidence (capability_id, tier, source_type, source_url, excerpt, run_id, title) values (${cap!.id}, 3, 'website', 'https://example.test', 'x', ${run!.id}, 'Example')`;
    const [e] = await sql<{ n: number }[]>`select count(*)::int as n from evidence where run_id = ${run!.id}`;
    expect(e!.n).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/enrichment-schema.test.ts`
Expected: FAIL with `column "product_title" of relation "capabilities" does not exist`.

- [ ] **Step 3: Write the migration**

`packages/core/src/db/migrations/0004_enrichment.sql`:

```sql
alter table suppliers
  add column detective_status text not null default 'pending' check (detective_status in ('pending', 'ok', 'error', 'skipped')),
  add column detective_run_id uuid references runs (id),
  add column detective_at timestamptz,
  add column summary text;

alter table capabilities
  alter column tariff_code drop not null,
  add column product_title text,
  add column origin text not null default 'tarmeez' check (origin in ('tarmeez', 'detective', 'mlcp', 'made_in_saudi', 'hunt')),
  add column class_confidence real check (class_confidence between 0 and 1),
  add column lenses jsonb,
  add column audit_run_id uuid references runs (id),
  add column audited_at timestamptz;
create unique index capabilities_found_unique on capabilities (supplier_id, hs6, lower(product_title)) where tariff_code is null;
create index capabilities_verdict_idx on capabilities (verdict);

alter table evidence
  add column run_id uuid references runs (id),
  add column title text;
create index evidence_tier_idx on evidence (tier);
```

- [ ] **Step 4: Run migrate and the test to verify it passes**

Run: `bun run migrate && perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/enrichment-schema.test.ts`
Expected: `applied: 0004_enrichment.sql`, then PASS, two tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/db/migrations/0004_enrichment.sql packages/core/test/enrichment-schema.test.ts
git commit -m "feat(core): enrichment columns for detective state, found capabilities and evidence provenance"
```

---

### Task 2: Tavily search and page fetch with disk caches

**Files:**
- Create: `packages/core/src/web/tavily.ts`, `packages/core/src/web/fetch.ts`
- Test: `packages/core/test/web.test.ts`

**Interfaces:**
- Produces: `type TavilyResult = { title: string; url: string; content: string; raw_content: string | null; score: number }`; `searchTavily(query: string, opts?: { maxResults?: number; fetchImpl?: typeof fetch; cacheDir?: string }): Promise<TavilyResult[]>`; `htmlToText(html: string): string`; `fetchText(url: string, opts?: { fetchImpl?: typeof fetch; cacheDir?: string; maxChars?: number }): Promise<{ url: string; title: string | null; text: string } | null>`.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/web.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchText, htmlToText } from "../src/web/fetch";
import { searchTavily } from "../src/web/tavily";

describe("htmlToText", () => {
  test("drops scripts, styles and tags, decodes entities and collapses whitespace", () => {
    const html = `<html><head><title>T</title><style>.a{}</style><script>var x=1;</script></head><body><nav>menu</nav><h1>Valves &amp; Pumps</h1><p>Ball&nbsp;valves 2&quot; SS316<br>Class 150</p></body></html>`;
    expect(htmlToText(html)).toBe("Valves & Pumps Ball valves 2\" SS316 Class 150");
  });
});

describe("searchTavily", () => {
  test("posts the query, returns results and caches them on disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kamin-tavily-"));
    let calls = 0;
    const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      expect(body.query).toBe("kanoo valves");
      return new Response(JSON.stringify({ results: [{ title: "Kanoo", url: "https://kanoo.example", content: "c", raw_content: "raw", score: 0.9 }] }), { status: 200 });
    }) as unknown as typeof fetch;
    process.env.TAVILY_API_KEY = process.env.TAVILY_API_KEY ?? "test-key";
    const a = await searchTavily("kanoo valves", { fetchImpl, cacheDir: dir });
    const b = await searchTavily("kanoo valves", { fetchImpl, cacheDir: dir });
    expect(a).toHaveLength(1);
    expect(a[0]!.url).toBe("https://kanoo.example");
    expect(b).toEqual(a);
    expect(calls).toBe(1);
  });
});

describe("fetchText", () => {
  test("fetches, extracts text, caps length and caches", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kamin-pages-"));
    let calls = 0;
    const fetchImpl = (async () => { calls++; return new Response(`<html><head><title>Kanoo Valves</title></head><body><p>${"valve ".repeat(5000)}</p></body></html>`, { status: 200, headers: { "content-type": "text/html" } }); }) as unknown as typeof fetch;
    const a = await fetchText("https://kanoo.example/products", { fetchImpl, cacheDir: dir, maxChars: 1000 });
    const b = await fetchText("https://kanoo.example/products", { fetchImpl, cacheDir: dir, maxChars: 1000 });
    expect(a!.title).toBe("Kanoo Valves");
    expect(a!.text.length).toBeLessThanOrEqual(1000);
    expect(b).toEqual(a);
    expect(calls).toBe(1);
  });
  test("returns null for non-html or failed responses", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kamin-pages-"));
    const fetchImpl = (async () => new Response("%PDF-1.4", { status: 200, headers: { "content-type": "application/pdf" } })) as unknown as typeof fetch;
    expect(await fetchText("https://x.example/a.pdf", { fetchImpl, cacheDir: dir })).toBeNull();
    const failing = (async () => new Response("nope", { status: 503 })) as unknown as typeof fetch;
    expect(await fetchText("https://x.example/b", { fetchImpl: failing, cacheDir: dir })).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/web.test.ts`
Expected: FAIL with "Cannot find module '../src/web/fetch'".

- [ ] **Step 3: Implement both modules**

`packages/core/src/web/tavily.ts`:

```ts
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../../../..");
export type TavilyResult = { title: string; url: string; content: string; raw_content: string | null; score: number };

export async function searchTavily(query: string, opts: { maxResults?: number; fetchImpl?: typeof fetch; cacheDir?: string } = {}): Promise<TavilyResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY is not set");
  const maxResults = opts.maxResults ?? 5;
  const cacheDir = opts.cacheDir ?? join(REPO_ROOT, "data/raw/tavily");
  const file = join(cacheDir, createHash("sha1").update(`${query}|${maxResults}`).digest("hex") + ".json");
  try {
    return JSON.parse(await readFile(file, "utf8")) as TavilyResult[];
  } catch {}
  const res = await (opts.fetchImpl ?? fetch)("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, max_results: maxResults, search_depth: "basic", include_raw_content: true }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`tavily ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { results?: Partial<TavilyResult>[] };
  const results: TavilyResult[] = (body.results ?? []).map((r) => ({
    title: String(r.title ?? ""), url: String(r.url ?? ""), content: String(r.content ?? ""),
    raw_content: typeof r.raw_content === "string" && r.raw_content.length ? r.raw_content : null, score: Number(r.score ?? 0),
  }));
  await mkdir(cacheDir, { recursive: true });
  await writeFile(file, JSON.stringify(results));
  return results;
}
```

`packages/core/src/web/fetch.ts`:

```ts
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../../../..");
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "-", mdash: "-", hellip: "...", laquo: "«", raquo: "»", copy: "©", reg: "®", trade: "™" };

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|footer|header|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|br|td|th|section|article)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped).replace(/\s+/g, " ").trim();
}

export function htmlTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]!).replace(/\s+/g, " ").trim() || null : null;
}

export async function fetchText(url: string, opts: { fetchImpl?: typeof fetch; cacheDir?: string; maxChars?: number } = {}): Promise<{ url: string; title: string | null; text: string } | null> {
  const cacheDir = opts.cacheDir ?? join(REPO_ROOT, "data/raw/pages");
  const maxChars = opts.maxChars ?? 12_000;
  const file = join(cacheDir, createHash("sha1").update(url).digest("hex") + ".json");
  try {
    const cached = JSON.parse(await readFile(file, "utf8")) as { url: string; title: string | null; text: string } | null;
    return cached && { ...cached, text: cached.text.slice(0, maxChars) };
  } catch {}
  let result: { url: string; title: string | null; text: string } | null = null;
  try {
    const res = await (opts.fetchImpl ?? fetch)(url, { headers: { "user-agent": "KAMIN research client (PIF Innovate Hackathon)", accept: "text/html,application/xhtml+xml" }, signal: AbortSignal.timeout(20_000), redirect: "follow" });
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && /html|xml|text\/plain/i.test(type)) {
      const html = await res.text();
      result = { url, title: htmlTitle(html), text: htmlToText(html).slice(0, maxChars) };
    }
  } catch {
    result = null;
  }
  await mkdir(cacheDir, { recursive: true });
  await writeFile(file, JSON.stringify(result));
  return result;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/web.test.ts`
Expected: PASS, four tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/web packages/core/test/web.test.ts
git commit -m "feat(core): Tavily search and page fetch with disk caches"
```

---

### Task 3: Detective queries, page selection and findings schema

**Files:**
- Create: `packages/core/src/detective/queries.ts`, `packages/core/src/detective/select.ts`, `packages/core/src/detective/schema.ts`
- Test: `packages/core/test/detective-pure.test.ts`

**Interfaces:**
- Produces: `type SupplierProfile = { id: string; name_ar: string | null; name_en: string | null; city_en: string | null; region_en: string | null; website: string | null; cr_number: string | null; declared: { hs6: string; title_en: string; title_ar: string; amount: number | null; unit: string | null }[] }`; `buildQueries(s: SupplierProfile): string[]` (two queries); `type PageCandidate = { url: string; title: string; snippet: string; text: string | null; kind: "own_site" | "directory" | "certification" | "news" | "social" | "other"; tier: 1 | 2 | 3; score: number }`; `classifyUrl(url: string, supplierTokens: string[]): { kind: PageCandidate["kind"]; tier: 1 | 2 | 3 }`; `selectPages(s: SupplierProfile, results: TavilyResult[], max?: number): PageCandidate[]`; `nameTokens(s: SupplierProfile): string[]`; zod `DetectiveFindings`, `DetectiveFindingsLoose`, type `DetectiveFindingsT`.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/detective-pure.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { buildQueries, nameTokens } from "../src/detective/queries";
import { classifyUrl, selectPages } from "../src/detective/select";
import { DetectiveFindingsLoose } from "../src/detective/schema";
import type { SupplierProfile } from "../src/detective/queries";

const kanoo: SupplierProfile = {
  id: "tarmeez:41699", name_ar: "مصنع شركة يوسف بن أحمد كانو للصمامات والمضخات", name_en: "sharikat yusuf bin ahmad kano lilsamamat walmadkhat Factory",
  city_en: "AlJubail", region_en: "Eastern Region", website: null, cr_number: "2055024776",
  declared: [{ hs6: "848100", title_en: "Taps, cocks, valves and similar appliances for pipes", title_ar: "حنفيات وصنابير وصمامات", amount: 150, unit: "Ton" }],
};

describe("queries", () => {
  test("nameTokens drops legal boilerplate and transliteration noise", () => {
    expect(nameTokens(kanoo)).toEqual(expect.arrayContaining(["kanoo", "كانو", "الصمامات", "المضخات"]));
    expect(nameTokens(kanoo)).not.toContain("شركة");
    expect(nameTokens(kanoo)).not.toContain("factory");
  });
  test("buildQueries makes one Arabic and one English query with the city and the product", () => {
    const q = buildQueries(kanoo);
    expect(q).toHaveLength(2);
    expect(q[0]).toContain("كانو");
    expect(q[0]).toContain("الجبيل");
    expect(q[1]).toMatch(/kanoo/i);
    expect(q[1]).toMatch(/valves/i);
    expect(q[1]).toMatch(/Saudi/);
  });
});

describe("classifyUrl", () => {
  test("recognises the supplier's own site, directories, certifications and social pages", () => {
    expect(classifyUrl("https://www.kanoo.com/ar/industrial", ["kanoo"])).toEqual({ kind: "own_site", tier: 3 });
    expect(classifyUrl("https://www.dnb.com/business-directory/company-profiles.kanoo.html", ["kanoo"])).toEqual({ kind: "directory", tier: 2 });
    expect(classifyUrl("https://sa.linkedin.com/company/ybakanoo", ["kanoo"])).toEqual({ kind: "directory", tier: 2 });
    expect(classifyUrl("https://saudimade.sa/en/members/kanoo", ["kanoo"])).toEqual({ kind: "certification", tier: 1 });
    expect(classifyUrl("https://www.instagram.com/p/xyz", ["kanoo"])).toEqual({ kind: "social", tier: 3 });
    expect(classifyUrl("https://www.arabnews.com/node/123", ["kanoo"])).toEqual({ kind: "news", tier: 3 });
  });
});

describe("selectPages", () => {
  test("keeps own site and directories first, drops social when better pages exist, caps the count", () => {
    const results = [
      { title: "Insta", url: "https://www.instagram.com/p/1", content: "post", raw_content: null, score: 0.7 },
      { title: "Kanoo", url: "https://www.kanoo.com/ar", content: "home", raw_content: "raw home", score: 0.4 },
      { title: "D&B", url: "https://www.dnb.com/business-directory/company-profiles.kanoo.html", content: "profile", raw_content: null, score: 0.8 },
      { title: "Machinery", url: "https://www.kanoomachinery.com/ksa", content: "equipment", raw_content: "raw eq", score: 0.5 },
      { title: "News", url: "https://www.arabnews.com/node/1", content: "news", raw_content: null, score: 0.3 },
    ];
    const pages = selectPages(kanoo, results, 3);
    expect(pages.map((p) => p.kind)).toEqual(["own_site", "own_site", "directory"]);
    expect(pages.some((p) => p.kind === "social")).toBe(false);
  });
});

describe("DetectiveFindingsLoose", () => {
  test("coerces a sloppy model reply into findings", () => {
    const f = DetectiveFindingsLoose.parse({
      website: "kanoo.com", is_same_company: "true",
      capabilities: [{ product: "Ball valves", hs6_guess: "8481.80", class_guess: "manufacturer", spec_attrs: { size: "2 inch" }, evidence: [{ url: "https://kanoo.com/p", excerpt: "x", kind: "catalogue" }] }],
      certifications: [{ name: "ISO 9001", url: "https://kanoo.com/iso" }],
      signals: { employees: 120 }, summary: "s",
    });
    expect(f.website).toBe("https://kanoo.com");
    expect(f.is_same_company).toBe(true);
    expect(f.capabilities[0]!.hs6_guess).toBe("848180");
    expect(f.capabilities[0]!.spec_attrs).toEqual([{ key: "size", value: "2 inch" }]);
    expect(f.certifications[0]!.excerpt).toBe("");
    expect(f.signals.employees).toBe("120");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/detective-pure.test.ts`
Expected: FAIL with "Cannot find module '../src/detective/queries'".

- [ ] **Step 3: Implement the three modules**

`packages/core/src/detective/queries.ts`:

```ts
export type SupplierProfile = {
  id: string; name_ar: string | null; name_en: string | null; city_en: string | null; region_en: string | null;
  website: string | null; cr_number: string | null;
  declared: { hs6: string; title_en: string; title_ar: string; amount: number | null; unit: string | null }[];
};

const AR_STOP = new Set(["شركة", "مصنع", "مؤسسة", "للصناعة", "للصناعات", "الصناعية", "المحدودة", "للتجارة", "التجارية", "شخص", "واحد", "و", "ال", "بن", "ابن", "فرع", "مجموعة", "ذات", "مسؤولية", "محدودة"]);
const EN_STOP = new Set(["factory", "company", "co", "ltd", "llc", "est", "establishment", "for", "and", "of", "the", "sharikat", "masna", "masnae", "lil", "shakhs", "wahid", "trading", "industrial", "industries", "industry", "group", "branch"]);
const CITY_AR: Record<string, string> = { AlJubail: "الجبيل", Jubail: "الجبيل", Dammam: "الدمام", Riyadh: "الرياض", Jeddah: "جدة", Makkah: "مكة", Madinah: "المدينة", Khobar: "الخبر", Yanbu: "ينبع", Qassim: "القصيم", Buraidah: "بريدة", Tabuk: "تبوك", Hail: "حائل", Abha: "أبها", Taif: "الطائف", Jazan: "جازان", Najran: "نجران" };

export function nameTokens(s: SupplierProfile): string[] {
  const ar = (s.name_ar ?? "").split(/[\s،,()\-]+/).filter((t) => t.length > 2 && !AR_STOP.has(t));
  const en = (s.name_en ?? "").toLowerCase().split(/[\s,()\-.]+/).filter((t) => t.length > 2 && !EN_STOP.has(t));
  const brand = en.filter((t) => !/^lil|^al[a-z]|^wal/.test(t));
  return [...new Set([...brand, ...en, ...ar])];
}

function productWord(s: SupplierProfile): string {
  const first = s.declared[0]?.title_en ?? "";
  const w = first.toLowerCase().match(/valve|pump|fitting|flange|pipe|tube|cable|wire|steel|plastic|chemical|food|paper|glass|aluminium|copper|cement|concrete|furniture|packag/);
  return w ? (w[0] === "valve" ? "valves" : w[0] === "pump" ? "pumps" : w[0] === "fitting" ? "pipe fittings" : w[0]) : "products";
}

export function buildQueries(s: SupplierProfile): string[] {
  const city = s.city_en ? (CITY_AR[s.city_en.replace(/\s+/g, "")] ?? s.city_en) : "";
  const arName = (s.name_ar ?? "").replace(/شخص واحد|ذات مسؤولية محدودة/g, "").trim();
  const enBrand = nameTokens(s).filter((t) => /^[a-z]+$/.test(t)).slice(0, 3).join(" ");
  const q1 = `${arName} ${city}`.trim();
  const q2 = `${enBrand || s.name_en || ""} ${productWord(s)} ${s.city_en ?? ""} Saudi Arabia`.replace(/\s+/g, " ").trim();
  return [q1, q2];
}
```

`packages/core/src/detective/select.ts`:

```ts
import type { TavilyResult } from "../web/tavily";
import { nameTokens, type SupplierProfile } from "./queries";

export type PageKind = "own_site" | "directory" | "certification" | "news" | "social" | "other";
export type PageCandidate = { url: string; title: string; snippet: string; text: string | null; kind: PageKind; tier: 1 | 2 | 3; score: number };

const SOCIAL = /instagram\.com|facebook\.com|twitter\.com|x\.com|tiktok\.com|youtube\.com|snapchat\.com|threads\.net/i;
const DIRECTORY = /linkedin\.com|dnb\.com|kompass\.com|saudiindustryguide|yellowpages|saudiyp|daleel|tradekey|exporthub|eworldtrade|europages|indiamart|alibaba\.com|made-in-china|zawya\.com\/companies|argaam|mcci\.org\.sa|chamber|psnr\.mim\.gov\.sa|lc\.mcci/i;
const CERT = /saudimade\.sa|iso\.org|saso\.gov\.sa|sfda\.gov\.sa|lcgpa\.gov\.sa|iktva|nusaned/i;
const NEWS = /arabnews|saudigazette|argaam|alriyadh|okaz|aleqt|spa\.gov\.sa|zawya\.com\/press|gulfnews|khaleejtimes|news/i;

export function classifyUrl(url: string, supplierTokens: string[]): { kind: PageKind; tier: 1 | 2 | 3 } {
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { return { kind: "other", tier: 3 }; }
  if (CERT.test(host)) return { kind: "certification", tier: 1 };
  if (SOCIAL.test(host)) return { kind: "social", tier: 3 };
  if (DIRECTORY.test(host)) return { kind: "directory", tier: 2 };
  const bare = host.replace(/^www\./, "").replace(/\.(com|sa|net|org|co|ae|biz|info)(\.sa)?$/g, "").replace(/[^a-z]/g, "");
  if (supplierTokens.some((t) => /^[a-z]{4,}$/.test(t) && bare.includes(t))) return { kind: "own_site", tier: 3 };
  if (NEWS.test(host)) return { kind: "news", tier: 3 };
  return { kind: "other", tier: 3 };
}

const KIND_RANK: Record<PageKind, number> = { own_site: 0, certification: 1, directory: 2, news: 3, other: 4, social: 5 };

export function selectPages(s: SupplierProfile, results: TavilyResult[], max = 4): PageCandidate[] {
  const tokens = nameTokens(s);
  const seen = new Set<string>();
  const pages: PageCandidate[] = [];
  for (const r of results) {
    if (!r.url || seen.has(r.url)) continue;
    seen.add(r.url);
    const { kind, tier } = classifyUrl(r.url, tokens);
    pages.push({ url: r.url, title: r.title, snippet: r.content, text: r.raw_content, kind, tier, score: r.score });
  }
  pages.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || b.score - a.score);
  const nonSocial = pages.filter((p) => p.kind !== "social");
  return (nonSocial.length ? nonSocial : pages).slice(0, max);
}
```

`packages/core/src/detective/schema.ts`:

```ts
import { z } from "zod";

export const CLASS_GUESSES = ["manufacturer", "assembler", "authorised_distributor", "trader", "unknown"] as const;
export const EVIDENCE_KINDS = ["certification", "award", "registry", "directory", "catalogue", "website", "news"] as const;

export const DetectiveFindings = z.object({
  website: z.string().nullable().describe("The supplier's own website if any page belongs to it"),
  is_same_company: z.boolean().describe("Whether the evidence pages refer to this supplier and not a namesake"),
  capabilities: z.array(z.object({
    product: z.string().describe("Product line in English, for example 'stainless steel ball valves'"),
    hs6_guess: z.string().nullable().describe("Six-digit HS subheading if you can tell"),
    class_guess: z.enum(CLASS_GUESSES).describe("manufacturer, assembler, authorised_distributor, trader, or unknown"),
    spec_attrs: z.array(z.object({ key: z.string(), value: z.string() })).describe("Sizes, materials, ratings, standards actually stated"),
    evidence: z.array(z.object({ url: z.string(), excerpt: z.string().describe("Up to 300 characters quoted from the page"), kind: z.enum(EVIDENCE_KINDS) })),
  })),
  certifications: z.array(z.object({ name: z.string(), url: z.string(), excerpt: z.string() })),
  signals: z.object({ employees: z.string().nullable(), capacity: z.string().nullable(), facility: z.string().nullable() }),
  summary: z.string().describe("Three sentences: what this company is, what it makes or sells, what the evidence shows"),
});
export type DetectiveFindingsT = z.infer<typeof DetectiveFindings>;

const record = (raw: unknown): Record<string, unknown> => (raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {});
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const nullableStr = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));
const bool = (v: unknown): boolean => v === true || String(v).toLowerCase() === "true" || String(v).toLowerCase() === "yes";
const pairs = (v: unknown): { key: string; value: string }[] =>
  Array.isArray(v) ? v.filter((x) => x && typeof x === "object" && "key" in (x as object)).map((x) => ({ key: str((x as { key: unknown }).key), value: str((x as { value?: unknown }).value) }))
  : v && typeof v === "object" ? Object.entries(v as Record<string, unknown>).filter(([, val]) => val !== null && val !== undefined && val !== "").map(([k, val]) => ({ key: k, value: str(val) })) : [];
const website = (v: unknown): string | null => {
  const s = nullableStr(v); if (!s) return null;
  const t = s.trim().replace(/\s.*$/, "");
  if (!/^https?:\/\//i.test(t)) return /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(t) ? `https://${t}` : null;
  return t;
};

export const DetectiveFindingsLoose: z.ZodType<DetectiveFindingsT> = z.preprocess((raw) => {
  const r = record(raw);
  r.website = website(r.website);
  r.is_same_company = bool(r.is_same_company);
  r.capabilities = (Array.isArray(r.capabilities) ? r.capabilities : []).map((c) => {
    const x = record(c);
    const code = str(x.hs6_guess).replace(/[^\d]/g, "").slice(0, 6);
    const guess = str(x.class_guess).toLowerCase().replace(/\s+/g, "_");
    return {
      product: str(x.product) || "unspecified product",
      hs6_guess: code.length === 6 ? code : null,
      class_guess: (CLASS_GUESSES as readonly string[]).includes(guess) ? guess : guess.includes("distrib") ? "authorised_distributor" : guess.includes("trad") || guess.includes("resell") || guess.includes("import") ? "trader" : guess.includes("assembl") ? "assembler" : guess.includes("manufact") || guess.includes("factory") ? "manufacturer" : "unknown",
      spec_attrs: pairs(x.spec_attrs),
      evidence: (Array.isArray(x.evidence) ? x.evidence : []).map((e) => { const y = record(e); const kind = str(y.kind).toLowerCase(); return { url: str(y.url), excerpt: str(y.excerpt).slice(0, 300), kind: (EVIDENCE_KINDS as readonly string[]).includes(kind) ? kind : "website" }; }).filter((e) => e.url),
    };
  });
  r.certifications = (Array.isArray(r.certifications) ? r.certifications : []).map((c) => { const y = record(c); return { name: str(y.name), url: str(y.url), excerpt: str(y.excerpt) }; }).filter((c) => c.name);
  const sig = record(r.signals);
  r.signals = { employees: nullableStr(sig.employees), capacity: nullableStr(sig.capacity), facility: nullableStr(sig.facility) };
  r.summary = str(r.summary);
  return r;
}, DetectiveFindings);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/detective-pure.test.ts`
Expected: PASS, five tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/detective/queries.ts packages/core/src/detective/select.ts packages/core/src/detective/schema.ts packages/core/test/detective-pure.test.ts
git commit -m "feat(core): detective queries, page selection and findings schema"
```

---

### Task 4: Detective persistence and run

**Files:**
- Create: `packages/core/src/detective/persist.ts`, `packages/core/src/detective/run.ts`, `packages/core/scripts/detective.ts`
- Test: `packages/core/test/detective-persist.test.ts`, `packages/core/test/detective-run.test.ts`

**Interfaces:**
- Produces: `loadProfile(db, supplierId): Promise<SupplierProfile>`; `mergeFindings(db, profile, findings, runId, pages): Promise<{ capabilities: number; evidence: number; created: number }>` where evidence tier comes from the page's `tier` when the evidence url matches a selected page, else from the evidence kind (certification or award 1, registry or directory 2, else 3); `runDetective(db, supplierId): Promise<{ runId: string; findings: DetectiveFindingsT; merged: { capabilities: number; evidence: number; created: number } }>`; `detectivePrompt(profile, pages)`.

- [ ] **Step 1: Write the failing persistence test**

`packages/core/test/detective-persist.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { loadProfile, mergeFindings } from "../src/detective/persist";

describe.skipIf(!process.env.DATABASE_URL)("mergeFindings", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from suppliers where id = 'test:det'`;
    await sql`insert into suppliers (id, name_ar, name_en, city_en, source, in_tarmeez) values ('test:det', 'مصنع الاختبار للصمامات', 'Test Valves Factory', 'Dammam', 'test', true)`;
    await sql`insert into products (tariff_code, hs6, title_ar, title_en, source) values ('848180000000', '848180', 'صمامات', 'Valves', 'test') on conflict do nothing`;
    await sql`insert into capabilities (supplier_id, tariff_code, hs6, class, declared_amount, declared_unit) values ('test:det', '848180000000', '848180', 'manufacturer', 100, 'Ton')`;
  });

  test("attaches evidence to the declared capability with the same hs6 and creates new ones for other findings", async () => {
    const [run] = await sql<{ id: string }[]>`insert into runs (role, input_ref, model) values ('detective', 'test:det', 'm') returning id`;
    const profile = await loadProfile(sql, "test:det");
    expect(profile.declared).toHaveLength(1);
    const merged = await mergeFindings(sql, profile, {
      website: "https://testvalves.example", is_same_company: true,
      capabilities: [
        { product: "stainless ball valves", hs6_guess: "848180", class_guess: "manufacturer", spec_attrs: [{ key: "size", value: "1/2 to 12 inch" }], evidence: [{ url: "https://testvalves.example/products", excerpt: "ball valves", kind: "catalogue" }] },
        { product: "centrifugal pumps", hs6_guess: "841370", class_guess: "authorised_distributor", spec_attrs: [], evidence: [{ url: "https://www.dnb.com/x", excerpt: "distributes pumps", kind: "directory" }] },
      ],
      certifications: [{ name: "ISO 9001", url: "https://testvalves.example/iso", excerpt: "certified" }],
      signals: { employees: "80", capacity: null, facility: null }, summary: "A valve maker.",
    }, run!.id, [{ url: "https://testvalves.example/products", title: "Products", snippet: "", text: null, kind: "own_site", tier: 3, score: 1 }]);
    expect(merged.created).toBe(1);
    const caps = await sql<{ hs6: string; origin: string; class: string; product_title: string | null }[]>`select hs6, origin, class, product_title from capabilities where supplier_id = 'test:det' order by hs6`;
    expect(caps).toEqual([{ hs6: "841370", origin: "detective", class: "authorised_distributor", product_title: "centrifugal pumps" }, { hs6: "848180", origin: "tarmeez", class: "manufacturer", product_title: null }]);
    const ev = await sql<{ tier: number; source_type: string }[]>`select e.tier, e.source_type from evidence e join capabilities c on c.id = e.capability_id where c.supplier_id = 'test:det' order by e.tier, e.source_type`;
    expect(ev.map((e) => [e.tier, e.source_type])).toEqual([[1, "certification"], [1, "certification"], [2, "directory"], [3, "catalogue"]]);
    const [s] = await sql<{ website: string; detective_status: string; summary: string }[]>`select website, detective_status, summary from suppliers where id = 'test:det'`;
    expect(s).toEqual({ website: "https://testvalves.example", detective_status: "ok", summary: "A valve maker." });
  });

  test("is idempotent for the same run", async () => {
    const [run] = await sql<{ id: string }[]>`select detective_run_id as id from suppliers where id = 'test:det'`;
    const before = await sql<{ n: number }[]>`select count(*)::int as n from evidence e join capabilities c on c.id = e.capability_id where c.supplier_id = 'test:det'`;
    const profile = await loadProfile(sql, "test:det");
    await mergeFindings(sql, profile, { website: null, is_same_company: true, capabilities: [{ product: "stainless ball valves", hs6_guess: "848180", class_guess: "manufacturer", spec_attrs: [], evidence: [{ url: "https://testvalves.example/products", excerpt: "ball valves", kind: "catalogue" }] }], certifications: [], signals: { employees: null, capacity: null, facility: null }, summary: "" }, run!.id, []);
    const after = await sql<{ n: number }[]>`select count(*)::int as n from evidence e join capabilities c on c.id = e.capability_id where c.supplier_id = 'test:det'`;
    expect(after[0]!.n).toBe(before[0]!.n);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/detective-persist.test.ts`
Expected: FAIL with "Cannot find module '../src/detective/persist'".

- [ ] **Step 3: Implement persistence**

`packages/core/src/detective/persist.ts`:

```ts
import type { Sql } from "postgres";
import type { SupplierProfile } from "./queries";
import type { DetectiveFindingsT } from "./schema";
import type { PageCandidate } from "./select";

export async function loadProfile(db: Sql, supplierId: string): Promise<SupplierProfile> {
  const [s] = await db<{ id: string; name_ar: string | null; name_en: string | null; city_en: string | null; region_en: string | null; website: string | null; cr_number: string | null }[]>`
    select id, name_ar, name_en, city_en, region_en, website, cr_number from suppliers where id = ${supplierId}`;
  if (!s) throw new Error(`supplier ${supplierId} not found`);
  const declared = await db<{ hs6: string; title_en: string; title_ar: string; amount: number | null; unit: string | null }[]>`
    select c.hs6, coalesce(p.title_en, c.product_title, '') as title_en, coalesce(p.title_ar, '') as title_ar, c.declared_amount::float as amount, c.declared_unit as unit
    from capabilities c left join products p on p.tariff_code = c.tariff_code
    where c.supplier_id = ${supplierId} and c.origin = 'tarmeez' order by c.hs6`;
  return { ...s, declared };
}

const TIER_BY_KIND: Record<string, 1 | 2 | 3> = { certification: 1, award: 1, registry: 2, directory: 2, catalogue: 3, website: 3, news: 3 };

export async function mergeFindings(db: Sql, profile: SupplierProfile, f: DetectiveFindingsT, runId: string, pages: PageCandidate[]): Promise<{ capabilities: number; evidence: number; created: number }> {
  const pageTier = new Map(pages.map((p) => [p.url, p.tier]));
  const tierFor = (url: string, kind: string): 1 | 2 | 3 => Math.min(pageTier.get(url) ?? 3, TIER_BY_KIND[kind] ?? 3) as 1 | 2 | 3;
  let evidenceCount = 0, created = 0, touched = 0;
  await db.begin(async (tx) => {
    await tx`delete from evidence where run_id = ${runId}`;
    const capIds: string[] = [];
    for (const cap of f.capabilities) {
      const hs6 = cap.hs6_guess;
      let id: string | undefined;
      if (hs6) {
        const [existing] = await tx<{ id: string }[]>`select id from capabilities where supplier_id = ${profile.id} and hs6 = ${hs6} order by (origin = 'tarmeez') desc, created_at limit 1`;
        id = existing?.id;
      }
      const cls = cap.class_guess === "unknown" ? null : cap.class_guess;
      if (id) {
        await tx`update capabilities set spec_attrs = coalesce(spec_attrs, '{}'::jsonb) || ${tx.json(Object.fromEntries(cap.spec_attrs.map((a) => [a.key, a.value])) as never)}, class = coalesce(${cls}, class), updated_at = now() where id = ${id}`;
      } else {
        const [row] = await tx<{ id: string }[]>`
          insert into capabilities (supplier_id, tariff_code, hs6, product_title, spec_attrs, class, origin)
          values (${profile.id}, null, ${hs6 ?? "000000"}, ${cap.product}, ${tx.json(Object.fromEntries(cap.spec_attrs.map((a) => [a.key, a.value])) as never)}, ${cls ?? (profile.declared.length ? "manufacturer" : "trader")}, 'detective')
          on conflict (supplier_id, hs6, lower(product_title)) where tariff_code is null do update set updated_at = now()
          returning id`;
        id = row!.id; created++;
      }
      capIds.push(id); touched++;
      for (const e of cap.evidence) {
        await tx`insert into evidence (capability_id, tier, source_type, source_url, excerpt, run_id, title) values (${id}, ${tierFor(e.url, e.kind)}, ${e.kind}, ${e.url}, ${e.excerpt}, ${runId}, ${pages.find((p) => p.url === e.url)?.title ?? null})`;
        evidenceCount++;
      }
    }
    const targets = capIds.length ? capIds : (await tx<{ id: string }[]>`select id from capabilities where supplier_id = ${profile.id}`).map((r) => r.id);
    for (const cert of f.certifications) {
      for (const id of targets) {
        await tx`insert into evidence (capability_id, tier, source_type, source_url, excerpt, run_id, title) values (${id}, 1, 'certification', ${cert.url || (f.website ?? "")}, ${`${cert.name}: ${cert.excerpt}`.slice(0, 300)}, ${runId}, ${cert.name})`;
        evidenceCount++;
      }
    }
    await tx`update suppliers set website = coalesce(website, ${f.website}), summary = coalesce(nullif(${f.summary}, ''), summary), detective_status = 'ok', detective_run_id = ${runId}, detective_at = now(), updated_at = now() where id = ${profile.id}`;
  });
  return { capabilities: touched, evidence: evidenceCount, created };
}
```

- [ ] **Step 4: Run the persistence test to verify it passes**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/detective-persist.test.ts`
Expected: PASS, two tests.

- [ ] **Step 5: Write the failing live run test**

`packages/core/test/detective-run.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { detectivePrompt, runDetective } from "../src/detective/run";
import { ollamaUp } from "../src/models/registry";

describe("detectivePrompt", () => {
  test("carries the declared products, the pages and the no-think switch", () => {
    const p = detectivePrompt({ id: "x", name_ar: "أ", name_en: "A", city_en: "Dammam", region_en: null, website: null, cr_number: "1", declared: [{ hs6: "848180", title_en: "Valves", title_ar: "صمامات", amount: 10, unit: "Ton" }] }, [{ url: "https://a.example", title: "A", snippet: "s", text: "long text", kind: "own_site", tier: 3, score: 1 }]);
    expect(p.system).toContain("/no_think");
    expect(p.human).toContain("848180");
    expect(p.human).toContain("https://a.example");
  });
});

describe.skipIf(!process.env.DATABASE_URL || !process.env.TAVILY_API_KEY || !(await ollamaUp()))("runDetective live", () => {
  test("investigates the Kanoo valves plant and persists evidence with a run", async () => {
    const r = await runDetective(sql, "tarmeez:41699");
    expect(r.findings.is_same_company).toBe(true);
    expect(r.merged.evidence).toBeGreaterThan(0);
    const steps = await sql<{ kind: string; name: string }[]>`select kind, name from run_steps where run_id = ${r.runId} order by seq`;
    expect(steps.filter((s) => s.kind === "retrieval").length).toBeGreaterThanOrEqual(2);
    expect(steps.some((s) => s.kind === "llm_call")).toBe(true);
    const [s] = await sql<{ detective_status: string }[]>`select detective_status from suppliers where id = 'tarmeez:41699'`;
    expect(s!.detective_status).toBe("ok");
  }, 400_000);
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/detective-run.test.ts`
Expected: FAIL with "Cannot find module '../src/detective/run'".

- [ ] **Step 7: Implement the run and the CLI**

`packages/core/src/detective/run.ts`:

```ts
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { Sql } from "postgres";
import { getChatModel, modelRefFor } from "../models/registry";
import { invokeStructured } from "../models/structured";
import { withRun } from "../trajectory/handler";
import { addStep } from "../trajectory/store";
import { fetchText } from "../web/fetch";
import { searchTavily } from "../web/tavily";
import { loadProfile, mergeFindings } from "./persist";
import { buildQueries, type SupplierProfile } from "./queries";
import { DetectiveFindings, DetectiveFindingsLoose, type DetectiveFindingsT } from "./schema";
import { selectPages, type PageCandidate } from "./select";

const PAGE_BUDGET = 14_000;

export function detectivePrompt(profile: SupplierProfile, pages: PageCandidate[]): { system: string; human: string } {
  const declared = profile.declared.map((d) => `- HS ${d.hs6}: ${d.title_en} | ${d.title_ar}${d.amount ? ` (declared ${d.amount} ${d.unit ?? ""}/year)` : ""}`).join("\n") || "- none declared";
  let budget = PAGE_BUDGET;
  const pageText = pages.map((p, i) => {
    const body = (p.text ?? p.snippet).slice(0, Math.max(0, Math.min(6000, budget)));
    budget -= body.length;
    return `### Page ${i + 1}: ${p.title}\nURL: ${p.url}\nKind: ${p.kind}\n${body}`;
  }).join("\n\n");
  return {
    system: [
      "You are an industrial supply-chain investigator working for a Saudi buyer. You read public evidence about one company and report what it can actually supply.",
      "Rules: never assert a capability without quoting the page that shows it; absence of evidence is a valid answer; distinguish a manufacturer (makes it), an assembler, an authorised distributor (named dealer of a brand) and a trader (imports and resells); if the pages are about a different company with a similar name, say is_same_company false and report nothing.",
      "hs6_guess must be a six-digit Harmonized System subheading: ball, gate, globe and butterfly valves 848180; check valves 848130; safety valves 848140; pressure reducing valves 848110; valve parts 848190; centrifugal pumps 841370; reciprocating pumps 841350; rotary pumps 841360; pump parts 841391; stainless flanges 730721; other steel flanges 730791; stainless butt-weld fittings 730723; other steel butt-weld fittings 730793; threaded stainless fittings 730722; copper alloy fittings 741220. Use null when unsure.",
      "Quote excerpts verbatim, at most 300 characters. Put the company's own site in website only if a page is clearly theirs.",
      "/no_think",
    ].join("\n"),
    human: `Company: ${profile.name_en ?? ""} | ${profile.name_ar ?? ""}\nCity: ${profile.city_en ?? "unknown"}, ${profile.region_en ?? ""}\nCommercial registration: ${profile.cr_number ?? "unknown"}\nDeclared in the national catalogue:\n${declared}\n\nEvidence pages:\n\n${pageText || "(no pages found)"}`,
  };
}

export async function runDetective(db: Sql, supplierId: string): Promise<{ runId: string; findings: DetectiveFindingsT; merged: { capabilities: number; evidence: number; created: number } }> {
  const profile = await loadProfile(db, supplierId);
  return withRun(db, { role: "detective", inputRef: supplierId, model: modelRefFor("detective") }, async (runId, handler) => {
    const queries = buildQueries(profile);
    const results = [];
    for (const q of queries) {
      const t = Date.now();
      try {
        const r = await searchTavily(q, { maxResults: 5 });
        results.push(...r);
        await addStep(db, runId, { kind: "retrieval", name: "tavily_search", input: { query: q }, output: r.map((x) => ({ url: x.url, title: x.title, score: x.score, raw: !!x.raw_content })), durationMs: Date.now() - t });
      } catch (err) {
        await addStep(db, runId, { kind: "error", name: "tavily_search", input: { query: q }, output: (err as Error).message, durationMs: Date.now() - t });
      }
    }
    if (profile.website) results.unshift({ title: "Own website", url: profile.website, content: "", raw_content: null, score: 1 });
    const pages = selectPages(profile, results, 4);
    for (const p of pages) {
      if (p.text) continue;
      const t = Date.now();
      const fetched = await fetchText(p.url);
      p.text = fetched?.text ?? null;
      if (fetched?.title) p.title = fetched.title;
      await addStep(db, runId, { kind: "tool_call", name: "fetch_page", input: { url: p.url }, output: { chars: p.text?.length ?? 0, title: p.title }, durationMs: Date.now() - t });
    }
    let findings: DetectiveFindingsT;
    if (!pages.length) {
      findings = { website: null, is_same_company: false, capabilities: [], certifications: [], signals: { employees: null, capacity: null, facility: null }, summary: "No public evidence found." };
      await addStep(db, runId, { kind: "note", name: "no_pages", output: { queries } });
    } else {
      const p = detectivePrompt(profile, pages);
      findings = await invokeStructured(getChatModel("detective"), [new SystemMessage(p.system), new HumanMessage(p.human)], {
        name: "detective_findings", description: "What the evidence pages show this company can supply", toolSchema: DetectiveFindings, parseSchema: DetectiveFindingsLoose,
        config: { callbacks: [handler], runName: "extract" },
        onRetry: (issues) => addStep(db, runId, { kind: "note", name: "extract_retry", output: { issues } }),
      });
    }
    const merged = findings.is_same_company
      ? await mergeFindings(db, profile, findings, runId, pages)
      : (await db`update suppliers set detective_status = 'ok', detective_run_id = ${runId}, detective_at = now(), summary = coalesce(nullif(${findings.summary}, ''), summary) where id = ${supplierId}`, { capabilities: 0, evidence: 0, created: 0 });
    await addStep(db, runId, { kind: "note", name: "merged", output: { ...merged, is_same_company: findings.is_same_company, website: findings.website } });
    return { runId, findings, merged };
  }).catch(async (err) => {
    await db`update suppliers set detective_status = 'error', detective_at = now() where id = ${supplierId}`;
    throw err;
  });
}
```

`packages/core/scripts/detective.ts`:

```ts
import { sql } from "../src/db/client";
import { runDetective } from "../src/detective/run";

const id = process.argv[2];
if (!id) { console.error("usage: bun run detective <supplierId, e.g. tarmeez:41699>"); process.exit(1); }
const r = await runDetective(sql, id);
console.log("\nsummary:", r.findings.summary);
console.log("website:", r.findings.website, "| same company:", r.findings.is_same_company);
for (const c of r.findings.capabilities) console.log(`- ${c.product} [${c.hs6_guess ?? "?"}] ${c.class_guess} evidence ${c.evidence.length}`);
console.log("merged:", r.merged);
await sql.end();
```

Add to the root `package.json` scripts: `"detective": "bun run packages/core/scripts/detective.ts"`.

- [ ] **Step 8: Run the live test and the CLI**

Run: `perl -e 'alarm 500; exec @ARGV' bun test packages/core/test/detective-run.test.ts`
Expected: PASS, two tests (the live one takes a minute or two and spends two Tavily credits the first time only).

Run: `bun run detective tarmeez:41699`
Expected: the terminal shows two `[retrieval] tavily_search` lines, `[tool_call] fetch_page` lines, one `[llm_call] extract`, and a merged summary.

- [ ] **Step 9: Typecheck and commit**

```bash
bun run typecheck
git add packages/core/src/detective/persist.ts packages/core/src/detective/run.ts packages/core/scripts/detective.ts packages/core/test/detective-persist.test.ts packages/core/test/detective-run.test.ts package.json
git commit -m "feat(core): Detective run: search, select, fetch, extract, merge evidence into the graph"
```

---

### Task 5: Auditor verdict mapping and run

**Files:**
- Create: `packages/core/src/auditor/schema.ts`, `packages/core/src/auditor/verdict.ts`, `packages/core/src/auditor/run.ts`, `packages/core/scripts/auditor.ts`
- Test: `packages/core/test/auditor.test.ts`

**Interfaces:**
- Produces: zod `AuditVerdict` with `real: { verdict: "supported" | "refuted" | "unknown"; reasoning: string; killer_evidence: string | null }`, `at_spec: { verdict; reasoning }`, `local: { class: "manufacturer" | "assembler" | "authorised_distributor" | "trader"; reasoning: string }`, `confidence: number`; `AuditVerdictLoose`; `lensesToVerdict(a: AuditVerdictT, tiers: number[]): { verdict: "supported" | "refuted" | "pending"; class: string; confidence: number }` where confidence is the model confidence times a tier factor (best tier 1 gives 1.0, 2 gives 0.85, 3 gives 0.6, none gives 0.4) and a refuted verdict caps confidence at 0.2; `runAuditor(db, capabilityId)`; `auditorPrompt(cap)`.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/auditor.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { AuditVerdictLoose } from "../src/auditor/schema";
import { lensesToVerdict } from "../src/auditor/verdict";
import { runAuditor } from "../src/auditor/run";
import { ollamaUp } from "../src/models/registry";

const base = { real: { verdict: "supported", reasoning: "r", killer_evidence: null }, at_spec: { verdict: "supported", reasoning: "s" }, local: { class: "trader", reasoning: "l" }, confidence: 0.8 } as const;

describe("lensesToVerdict", () => {
  test("both lenses supported gives supported, class from the local lens, tier factor applied", () => {
    expect(lensesToVerdict(base, [3, 2])).toEqual({ verdict: "supported", class: "trader", confidence: 0.68 });
    expect(lensesToVerdict(base, [1])).toEqual({ verdict: "supported", class: "trader", confidence: 0.8 });
    expect(lensesToVerdict(base, [])).toEqual({ verdict: "supported", class: "trader", confidence: 0.32 });
  });
  test("a refuting lens refutes and caps confidence, a trader never refutes", () => {
    expect(lensesToVerdict({ ...base, real: { verdict: "refuted", reasoning: "dead", killer_evidence: "CR expired" } }, [2]).verdict).toBe("refuted");
    expect(lensesToVerdict({ ...base, at_spec: { verdict: "refuted", reasoning: "category only" } }, [2]).confidence).toBeLessThanOrEqual(0.2);
    expect(lensesToVerdict({ ...base, local: { class: "trader", reasoning: "imports" } }, [2]).verdict).toBe("supported");
  });
  test("an unknown lens leaves the verdict pending", () => {
    expect(lensesToVerdict({ ...base, at_spec: { verdict: "unknown", reasoning: "no spec on record" } }, [2]).verdict).toBe("pending");
  });
});

describe("AuditVerdictLoose", () => {
  test("coerces sloppy lens values", () => {
    const v = AuditVerdictLoose.parse({ real: { verdict: "Supported", reasoning: "r" }, at_spec: { verdict: "cannot tell", reasoning: "s" }, local: { class: "Authorised Distributor", reasoning: "l" }, confidence: "0.7" });
    expect(v.real.verdict).toBe("supported");
    expect(v.at_spec.verdict).toBe("unknown");
    expect(v.local.class).toBe("authorised_distributor");
    expect(v.confidence).toBe(0.7);
  });
});

describe.skipIf(!process.env.DATABASE_URL || !(await ollamaUp()))("runAuditor live", () => {
  beforeAll(async () => {
    await sql`delete from suppliers where id = 'test:aud'`;
    await sql`insert into suppliers (id, name_ar, name_en, city_en, source, summary) values ('test:aud', 'شركة الخليج للتجارة', 'Gulf Trading Co', 'Riyadh', 'test', 'A trading company that imports and resells valves.')`;
    await sql`insert into capabilities (supplier_id, hs6, product_title, class, origin, spec_attrs) values ('test:aud', '848180', 'stainless steel ball valves', 'manufacturer', 'detective', '{"size": "1/2 to 4 inch", "brand": "Italian brand"}')`;
    const [cap] = await sql<{ id: string }[]>`select id from capabilities where supplier_id = 'test:aud'`;
    await sql`insert into evidence (capability_id, tier, source_type, source_url, excerpt) values (${cap!.id}, 3, 'website', 'https://gulftrading.example/valves', 'We are the exclusive importer and stockist of Italian stainless steel ball valves 1/2 to 4 inch for the Saudi market.')`;
  });
  test("classifies an importer as a trader without refuting a real, at-spec capability", async () => {
    const [cap] = await sql<{ id: string }[]>`select id from capabilities where supplier_id = 'test:aud'`;
    const r = await runAuditor(sql, cap!.id);
    expect(["trader", "authorised_distributor"]).toContain(r.class);
    expect(r.verdict).not.toBe("refuted");
    const [row] = await sql<{ class: string; verdict: string; audit_run_id: string }[]>`select class, verdict, audit_run_id from capabilities where id = ${cap!.id}`;
    expect(row!.class).toBe(r.class);
    expect(row!.audit_run_id).toBe(r.runId);
  }, 300_000);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/auditor.test.ts`
Expected: FAIL with "Cannot find module '../src/auditor/schema'".

- [ ] **Step 3: Implement schema, verdict mapping and run**

`packages/core/src/auditor/schema.ts`:

```ts
import { z } from "zod";

const LENS = ["supported", "refuted", "unknown"] as const;
const CLASSES = ["manufacturer", "assembler", "authorised_distributor", "trader"] as const;

export const AuditVerdict = z.object({
  real: z.object({ verdict: z.enum(LENS).describe("Is this capability real: does the company exist, is it active, does the evidence actually show this product?"), reasoning: z.string(), killer_evidence: z.string().nullable().describe("The single fact that refutes it, if refuted") }),
  at_spec: z.object({ verdict: z.enum(LENS).describe("Does the evidence support the product at the stated specification, or only a category?"), reasoning: z.string() }),
  local: z.object({ class: z.enum(CLASSES).describe("manufacturer makes it in the Kingdom; assembler assembles imported parts; authorised_distributor is a named dealer of a foreign brand; trader imports and resells"), reasoning: z.string() }),
  confidence: z.number().min(0).max(1),
});
export type AuditVerdictT = z.infer<typeof AuditVerdict>;

const record = (raw: unknown): Record<string, unknown> => (raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {});
const lens = (v: unknown): (typeof LENS)[number] => { const s = String(v ?? "").toLowerCase(); return s.startsWith("support") || s === "yes" || s === "true" ? "supported" : s.startsWith("refut") || s === "no" || s === "false" ? "refuted" : "unknown"; };
const cls = (v: unknown): (typeof CLASSES)[number] => { const s = String(v ?? "").toLowerCase().replace(/[\s-]+/g, "_"); return (CLASSES as readonly string[]).includes(s) ? s as (typeof CLASSES)[number] : s.includes("distrib") || s.includes("dealer") || s.includes("agent") ? "authorised_distributor" : s.includes("assembl") ? "assembler" : s.includes("trad") || s.includes("import") || s.includes("resell") || s.includes("stockist") ? "trader" : "manufacturer"; };
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

export const AuditVerdictLoose: z.ZodType<AuditVerdictT> = z.preprocess((raw) => {
  const r = record(raw);
  const real = record(r.real), spec = record(r.at_spec), local = record(r.local);
  const c = typeof r.confidence === "number" ? r.confidence : Number(r.confidence);
  return {
    real: { verdict: lens(real.verdict), reasoning: str(real.reasoning), killer_evidence: real.killer_evidence === null || real.killer_evidence === undefined || real.killer_evidence === "" ? null : str(real.killer_evidence) },
    at_spec: { verdict: lens(spec.verdict), reasoning: str(spec.reasoning) },
    local: { class: cls(local.class), reasoning: str(local.reasoning) },
    confidence: Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0.5,
  };
}, AuditVerdict);
```

`packages/core/src/auditor/verdict.ts`:

```ts
import type { AuditVerdictT } from "./schema";

const TIER_FACTOR: Record<number, number> = { 1: 1, 2: 0.85, 3: 0.6, 4: 0.4 };

export function lensesToVerdict(a: AuditVerdictT, tiers: number[]): { verdict: "supported" | "refuted" | "pending"; class: string; confidence: number } {
  const best = tiers.length ? Math.min(...tiers) : null;
  const factor = best ? TIER_FACTOR[best] ?? 0.4 : 0.4;
  const refuted = a.real.verdict === "refuted" || a.at_spec.verdict === "refuted";
  const supported = a.real.verdict === "supported" && a.at_spec.verdict === "supported";
  const raw = Number((a.confidence * factor).toFixed(2));
  return { verdict: refuted ? "refuted" : supported ? "supported" : "pending", class: a.local.class, confidence: refuted ? Math.min(raw, 0.2) : raw };
}
```

`packages/core/src/auditor/run.ts`:

```ts
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { Sql } from "postgres";
import { getChatModel, modelRefFor } from "../models/registry";
import { invokeStructured } from "../models/structured";
import { withRun } from "../trajectory/handler";
import { addStep } from "../trajectory/store";
import { AuditVerdict, AuditVerdictLoose } from "./schema";
import { lensesToVerdict } from "./verdict";

export type CapabilityForAudit = {
  id: string; supplier_id: string; supplier_name_en: string | null; supplier_name_ar: string | null; city_en: string | null; supplier_summary: string | null; cr_number: string | null;
  hs6: string; product_title: string | null; product_en: string | null; class: string; spec_attrs: Record<string, string>; declared_amount: number | null; declared_unit: string | null; origin: string;
  evidence: { tier: number; source_type: string; source_url: string; excerpt: string | null; title: string | null }[];
};

export async function loadCapability(db: Sql, capabilityId: string): Promise<CapabilityForAudit> {
  const [c] = await db<Omit<CapabilityForAudit, "evidence">[]>`
    select c.id, c.supplier_id, s.name_en as supplier_name_en, s.name_ar as supplier_name_ar, s.city_en, s.summary as supplier_summary, s.cr_number,
           c.hs6, c.product_title, p.title_en as product_en, c.class, c.spec_attrs, c.declared_amount::float as declared_amount, c.declared_unit, c.origin
    from capabilities c join suppliers s on s.id = c.supplier_id left join products p on p.tariff_code = c.tariff_code
    where c.id = ${capabilityId}`;
  if (!c) throw new Error(`capability ${capabilityId} not found`);
  const evidence = await db<CapabilityForAudit["evidence"]>`select tier, source_type, source_url, excerpt, title from evidence where capability_id = ${capabilityId} order by tier, fetched_at`;
  return { ...c, evidence };
}

export function auditorPrompt(cap: CapabilityForAudit): { system: string; human: string } {
  const ev = cap.evidence.map((e, i) => `${i + 1}. [tier ${e.tier}, ${e.source_type}] ${e.source_url}\n   "${(e.excerpt ?? "").slice(0, 300)}"`).join("\n") || "(no evidence beyond the catalogue declaration)";
  return {
    system: [
      "You are an adversarial auditor for a Saudi industrial buyer. Your job is to REFUTE the capability claim below. Default to refuted when you are uncertain whether it is real or at specification, and to unknown only when the evidence is silent.",
      "Three lenses, answered separately: real (does this company exist and does the evidence show this product at all), at_spec (does the evidence support the stated attributes, or only a broad category), local (classify the company for this product as manufacturer, assembler, authorised_distributor or trader).",
      "Being a trader or a distributor is never grounds for refutation; it is a classification. A tier 2 registry declaration alone means real is supported and at_spec is unknown unless attributes are stated.",
      "Give one sentence of reasoning per lens, a killer_evidence fact when you refute, and an overall confidence between 0 and 1 in your own findings.",
      "/no_think",
    ].join("\n"),
    human: `Company: ${cap.supplier_name_en ?? ""} | ${cap.supplier_name_ar ?? ""} (${cap.city_en ?? "city unknown"}, CR ${cap.cr_number ?? "unknown"})\nWhat we know about the company: ${cap.supplier_summary ?? "nothing beyond the registry"}\n\nClaim: can supply "${cap.product_title ?? cap.product_en ?? cap.hs6}" (HS ${cap.hs6}) as a ${cap.class}${cap.declared_amount ? `, declared capacity ${cap.declared_amount} ${cap.declared_unit ?? ""} per year` : ""}\nStated attributes: ${Object.entries(cap.spec_attrs ?? {}).map(([k, v]) => `${k}=${v}`).join(", ") || "none"}\nOrigin of the claim: ${cap.origin}\n\nEvidence:\n${ev}`,
  };
}

export async function runAuditor(db: Sql, capabilityId: string): Promise<{ runId: string; verdict: "supported" | "refuted" | "pending"; class: string; confidence: number }> {
  const cap = await loadCapability(db, capabilityId);
  return withRun(db, { role: "auditor", inputRef: capabilityId, model: modelRefFor("auditor") }, async (runId, handler) => {
    const p = auditorPrompt(cap);
    const lenses = await invokeStructured(getChatModel("auditor"), [new SystemMessage(p.system), new HumanMessage(p.human)], {
      name: "audit_verdict", description: "The three-lens audit of one capability claim", toolSchema: AuditVerdict, parseSchema: AuditVerdictLoose,
      config: { callbacks: [handler], runName: "audit" },
      onRetry: (issues) => addStep(db, runId, { kind: "note", name: "audit_retry", output: { issues } }),
    });
    const result = lensesToVerdict(lenses, cap.evidence.map((e) => e.tier));
    await db`update capabilities set verdict = ${result.verdict}, class = ${result.class}, confidence = ${result.confidence}, class_confidence = ${lenses.confidence}, lenses = ${db.json(lenses as never)}, audit_run_id = ${runId}, audited_at = now(), status = 'audited', updated_at = now() where id = ${capabilityId}`;
    await addStep(db, runId, { kind: "note", name: "verdict", output: { ...result, killer_evidence: lenses.real.killer_evidence } });
    return { runId, ...result };
  });
}
```

`packages/core/scripts/auditor.ts`:

```ts
import { sql } from "../src/db/client";
import { runAuditor } from "../src/auditor/run";

const id = process.argv[2];
if (!id) { console.error("usage: bun run auditor <capabilityId>"); process.exit(1); }
console.log(await runAuditor(sql, id));
await sql.end();
```

Add to the root `package.json` scripts: `"auditor": "bun run packages/core/scripts/auditor.ts"`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `perl -e 'alarm 400; exec @ARGV' bun test packages/core/test/auditor.test.ts`
Expected: PASS, five tests.

- [ ] **Step 5: Typecheck and commit**

```bash
bun run typecheck
git add packages/core/src/auditor packages/core/scripts/auditor.ts packages/core/test/auditor.test.ts package.json
git commit -m "feat(core): Auditor run: three lenses in one adversarial call, verdict and class mapping"
```

---

### Task 6: MLCP registry ingest

**Files:**
- Create: `packages/core/src/mlcp/parse.ts`, `packages/core/src/mlcp/ingest.ts`, `packages/core/scripts/ingest-mlcp.ts`, `packages/core/test/fixtures/mlcp-list-page.html`, `packages/core/test/fixtures/mlcp-detail.html`
- Test: `packages/core/test/mlcp.test.ts`

**Interfaces:**
- Produces: `parseListPage(html): { cr: string; name: string; activity: string | null }[]`; `parseDetailPage(html): { name: string | null; activity: string | null; address: string | null; capacity_total: string | null; products: { name: string; quantity: number | null; unit: string | null }[] }`; `lastPageNumber(html): number`; `ingestMlcp(db, opts?): Promise<{ pages: number; factories: number; matched: number; created: number }>`.

- [ ] **Step 1: Save the fixtures**

```bash
cp /private/tmp/claude-501/-Users-mohammedshalabi-workspace-kamin/caabe715-7534-4fe2-94a2-b2c2dad11455/scratchpad/mlcp_page1.html packages/core/test/fixtures/mlcp-list-page.html
cp /private/tmp/claude-501/-Users-mohammedshalabi-workspace-kamin/caabe715-7534-4fe2-94a2-b2c2dad11455/scratchpad/mlcp_detail.html packages/core/test/fixtures/mlcp-detail.html
```

- [ ] **Step 2: Write the failing tests**

`packages/core/test/mlcp.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lastPageNumber, parseDetailPage, parseListPage } from "../src/mlcp/parse";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { ingestMlcp } from "../src/mlcp/ingest";

const list = readFileSync(join(import.meta.dir, "fixtures/mlcp-list-page.html"), "utf8");
const detail = readFileSync(join(import.meta.dir, "fixtures/mlcp-detail.html"), "utf8");

describe("mlcp parse", () => {
  test("parseListPage yields one factory per card with CR, name and activity", () => {
    const rows = parseListPage(list);
    expect(rows.length).toBe(12);
    expect(rows[0]).toEqual({ cr: "1010640506", name: "شركة اماد الصناعية", activity: "صنع المواد الكيميائية والمنتجات الكيميائية" });
    expect(rows.every((r) => /^\d{10}$/.test(r.cr))).toBe(true);
  });
  test("lastPageNumber reads the pager", () => {
    expect(lastPageNumber(list)).toBeGreaterThanOrEqual(5);
  });
  test("parseDetailPage reads the header fields and dedupes the product table", () => {
    const d = parseDetailPage(detail);
    expect(d.name).toBe("شركة اماد الصناعية");
    expect(d.activity).toBe("صنع المواد الكيميائية والمنتجات الكيميائية");
    expect(d.capacity_total).toContain("56,576");
    expect(d.products.length).toBe(19);
    expect(d.products[0]).toEqual({ name: "عطور وكولونيا", quantity: 288, unit: "طن متري" });
    expect(d.products[1]).toEqual({ name: "شامبو للشعر", quantity: 2000, unit: "طن متري" });
  });
});

describe.skipIf(!process.env.DATABASE_URL)("ingestMlcp", () => {
  beforeAll(async () => { await migrate(sql); });
  test("upserts factories on CR from injected pages and flags matches with Tarmeez", async () => {
    await sql`delete from suppliers where id in ('mlcp:1010640506', 'test:mlcp-match')`;
    await sql`insert into suppliers (id, name_ar, cr_number, source, in_tarmeez) values ('test:mlcp-match', 'شركة اماد الصناعية', '1010640506', 'test', true)`;
    const r = await ingestMlcp(sql, { pages: { 1: list }, details: { "1010640506": detail } });
    expect(r.factories).toBe(12);
    expect(r.matched).toBe(1);
    const [m] = await sql<{ in_mlcp: boolean }[]>`select in_mlcp from suppliers where id = 'test:mlcp-match'`;
    expect(m!.in_mlcp).toBe(true);
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from suppliers where source = 'mlcp' and cr_number in (select cr_number from suppliers where source = 'mlcp')`;
    expect(n!.n).toBeGreaterThanOrEqual(11);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/mlcp.test.ts`
Expected: FAIL with "Cannot find module '../src/mlcp/parse'".

- [ ] **Step 4: Implement parse and ingest**

`packages/core/src/mlcp/parse.ts`:

```ts
import { decodeEntities } from "../web/fetch";

const clean = (s: string): string => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/ /g, " ").replace(/\s+/g, " ").trim();

export function parseListPage(html: string): { cr: string; name: string; activity: string | null }[] {
  const out: { cr: string; name: string; activity: string | null }[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/href="\/Home\/FactoryDetails\/(\d{6,12})"/g)) {
    const cr = m[1]!;
    if (seen.has(cr)) continue;
    seen.add(cr);
    const before = clean(html.slice(Math.max(0, m.index! - 3000), m.index!));
    const nameM = before.match(/المصنع\s*:\s*(.+?)\s*(?:\||$)/);
    const tail = nameM ? before.slice(before.indexOf(nameM[0]) + nameM[0].length) : "";
    const name = nameM ? nameM[1]!.replace(/\|.*$/, "").trim() : "";
    const activity = tail.replace(/[|]/g, " ").replace(/التفاصيل.*$/, "").replace(/\s+/g, " ").trim() || null;
    out.push({ cr, name, activity });
  }
  return out;
}

export function lastPageNumber(html: string): number {
  const nums = [...html.matchAll(/pageNumber=(\d+)/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 1;
}

function fieldAfter(html: string, label: string): string | null {
  const i = html.indexOf(label);
  if (i < 0) return null;
  const seg = clean(html.slice(i + label.length, i + label.length + 600));
  const v = seg.replace(/^[\s:|]+/, "").split("|")[0]!.trim();
  return v || null;
}

export function parseDetailPage(html: string) {
  const heads = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => clean(m[1]!)).filter((t) => t && t !== "بيانات المصنع");
  const products: { name: string; quantity: number | null; unit: string | null }[] = [];
  const seen = new Set<string>();
  const tbody = html.match(/<tbody[\s\S]*?<\/tbody>/);
  for (const row of (tbody?.[0] ?? "").matchAll(/<tr[\s\S]*?<\/tr>/g)) {
    const cells = [...row[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => clean(c[1]!));
    if (cells.length < 4) continue;
    const name = cells[1]!;
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    const qty = Number(cells[2]!.replace(/[^\d.]/g, ""));
    products.push({ name, quantity: Number.isFinite(qty) && cells[2] ? qty : null, unit: cells[3] || null });
  }
  return {
    name: heads[0] ?? null,
    activity: fieldAfter(html, "النشاط الرئيسي"),
    address: fieldAfter(html, "العنوان"),
    capacity_total: fieldAfter(html, "إجمالي كمية الطاقة الاستيعابية"),
    products,
  };
}
```

`packages/core/src/mlcp/ingest.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Sql } from "postgres";
import { lastPageNumber, parseDetailPage, parseListPage } from "./parse";

const REPO_ROOT = join(import.meta.dir, "../../../..");
const BASE = "https://lc.mcci.org.sa";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cachedGet(path: string, cacheDir: string, fetchImpl: typeof fetch): Promise<string | null> {
  const file = join(cacheDir, path.replace(/[^A-Za-z0-9]+/g, "_") + ".html");
  try { return await readFile(file, "utf8"); } catch {}
  const res = await fetchImpl(BASE + path, { headers: { "user-agent": "KAMIN research client (PIF Innovate Hackathon)" }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return null;
  const html = await res.text();
  await mkdir(cacheDir, { recursive: true });
  await writeFile(file, html);
  await sleep(300);
  return html;
}

export async function ingestMlcp(db: Sql, opts: { pages?: Record<number, string>; details?: Record<string, string>; fetchImpl?: typeof fetch; maxPages?: number } = {}): Promise<{ pages: number; factories: number; matched: number; created: number }> {
  const cacheDir = join(REPO_ROOT, "data/raw/mlcp");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const getPage = async (n: number) => opts.pages ? (opts.pages[n] ?? null) : cachedGet(`/Home/Factories?pageNumber=${n}`, cacheDir, fetchImpl);
  const getDetail = async (cr: string) => opts.details ? (opts.details[cr] ?? null) : cachedGet(`/Home/FactoryDetails/${cr}`, cacheDir, fetchImpl);
  let pages = 0, factories = 0, matched = 0, created = 0;
  let last = opts.maxPages ?? 1;
  const seen = new Set<string>();
  for (let n = 1; n <= last; n++) {
    const html = await getPage(n);
    if (!html) break;
    pages++;
    if (!opts.maxPages && !opts.pages) last = Math.max(last, Math.min(lastPageNumber(html), 200));
    const rows = parseListPage(html);
    if (!rows.length) break;
    for (const row of rows) {
      if (seen.has(row.cr)) continue;
      seen.add(row.cr); factories++;
      const detailHtml = await getDetail(row.cr);
      const detail = detailHtml ? parseDetailPage(detailHtml) : null;
      const raw = { list: row, detail };
      const [existing] = await db<{ id: string }[]>`select id from suppliers where cr_number = ${row.cr} and source <> 'mlcp' limit 1`;
      if (existing) {
        matched++;
        await db`update suppliers set in_mlcp = true, raw = coalesce(raw, '{}'::jsonb) || ${db.json({ mlcp: raw } as never)}, updated_at = now() where id = ${existing.id}`;
      } else {
        const [ins] = await db<{ id: string }[]>`
          insert into suppliers (id, name_ar, cr_number, city_ar, region_en, source, in_mlcp, raw)
          values (${`mlcp:${row.cr}`}, ${detail?.name ?? row.name}, ${row.cr}, ${detail?.address ?? null}, 'Madinah Region', 'mlcp', true, ${db.json({ mlcp: raw } as never)})
          on conflict (id) do update set name_ar = excluded.name_ar, raw = excluded.raw, in_mlcp = true, updated_at = now()
          returning (xmax = 0) as inserted`;
        if ((ins as unknown as { inserted: boolean } | undefined)?.inserted) created++;
      }
    }
  }
  return { pages, factories, matched, created };
}
```

`packages/core/scripts/ingest-mlcp.ts`:

```ts
import { sql } from "../src/db/client";
import { ingestMlcp } from "../src/mlcp/ingest";

console.log(await ingestMlcp(sql));
const [row] = await sql<{ n: number; m: number }[]>`select count(*) filter (where source = 'mlcp')::int as n, count(*) filter (where in_mlcp and source <> 'mlcp')::int as m from suppliers`;
console.log(`mlcp-only suppliers: ${row!.n}, tarmeez suppliers also in MLCP: ${row!.m}`);
await sql.end();
```

Add to the root `package.json` scripts: `"ingest:mlcp": "bun run packages/core/scripts/ingest-mlcp.ts"`.

- [ ] **Step 5: Run the tests, then the live ingest**

Run: `perl -e 'alarm 120; exec @ARGV' bun test packages/core/test/mlcp.test.ts`
Expected: PASS, four tests.

Run: `perl -e 'alarm 1800; exec @ARGV' bun run ingest:mlcp`
Expected: a few hundred factories over a few dozen pages, with a small `matched` count (Madinah plants that also registered in Tarmeez).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/mlcp packages/core/scripts/ingest-mlcp.ts packages/core/test/mlcp.test.ts packages/core/test/fixtures/mlcp-list-page.html packages/core/test/fixtures/mlcp-detail.html package.json
git commit -m "feat(core): MLCP registry ingest joined on CR number"
```

---

### Task 7: Made in Saudi capture and load

**Files:**
- Create: `packages/core/src/text/names.ts`, `packages/core/src/madeinsaudi/capture.ts`, `packages/core/src/madeinsaudi/load.ts`, `packages/core/scripts/capture-made-in-saudi.ts`, `packages/core/scripts/load-made-in-saudi.ts`
- Test: `packages/core/test/names.test.ts`, `packages/core/test/madeinsaudi-load.test.ts`

**Interfaces:**
- Produces: `normaliseArabic(s: string): string` (strip tashkeel and tatweel, unify alef forms, ta marbuta to ha, alef maqsura to ya, drop the definite article per token, drop legal words); `nameSimilarity(a: string, b: string): number` (token Jaccard after normalisation, both scripts); `type Member = { id: string | number; name: string | null; name_arabic: string | null; products: string[]; categories: string[]; city: string | null; website: string | null; raw: unknown }`; `extractMembers(payloads: unknown[]): Member[]`; `loadMembers(db, members, { threshold?: number }): Promise<{ members: number; matched: number; evidence: number }>`.

- [ ] **Step 1: Write the failing name tests**

`packages/core/test/names.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { nameSimilarity, normaliseArabic } from "../src/text/names";

describe("names", () => {
  test("normaliseArabic unifies forms and drops boilerplate", () => {
    expect(normaliseArabic("شركة أماد الصناعيّة المحدودة")).toBe("اماد الصناعيه");
    expect(normaliseArabic("مصنع الخليج للصمامات")).toBe("الخليج للصمامات");
  });
  test("nameSimilarity is high for the same company across spellings and low for strangers", () => {
    expect(nameSimilarity("شركة اماد الصناعية", "شركة أماد الصناعيه المحدودة")).toBeGreaterThanOrEqual(0.9);
    expect(nameSimilarity("Yusuf Bin Ahmed Kanoo Pumps and Valves Factory", "sharikat yusuf bin ahmad kano lilsamamat walmadkhat Factory")).toBeGreaterThanOrEqual(0.3);
    expect(nameSimilarity("شركة اماد الصناعية", "مصنع الخليج للصمامات")).toBeLessThan(0.2);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/names.test.ts`
Expected: FAIL with "Cannot find module '../src/text/names'".

- [ ] **Step 3: Implement names**

`packages/core/src/text/names.ts`:

```ts
const AR_BOILER = new Set(["شركه", "شركة", "مصنع", "مؤسسه", "مؤسسة", "المحدوده", "المحدودة", "للصناعه", "للصناعة", "للتجاره", "للتجارة", "التجاريه", "التجارية", "شخص", "واحد", "ذات", "مسؤوليه", "مسؤولية", "محدوده", "محدودة", "فرع", "و"]);
const EN_BOILER = new Set(["company", "co", "ltd", "llc", "limited", "factory", "est", "establishment", "for", "and", "of", "the", "sharikat", "masna", "lil", "shakhs", "wahid", "group", "industrial", "industries", "industry", "trading", "bin", "ibn", "al"]);

export function normaliseArabic(s: string): string {
  const t = s
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^؀-ۿ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !AR_BOILER.has(w))
    .join(" ");
  return t.trim();
}

const enTokens = (s: string): string[] => s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !EN_BOILER.has(w)).map((w) => w.replace(/^(al|el)(?=[a-z]{3,})/, "").replace(/(o|u)+/g, "o").replace(/ee|ea|ie/g, "i").replace(/[aeiou]+$/, ""));
const arTokens = (s: string): string[] => normaliseArabic(s).split(/\s+/).filter(Boolean).map((w) => w.replace(/^(ال|لل|وال|بال)/, ""));

export function nameSimilarity(a: string, b: string): number {
  const ta = new Set([...arTokens(a), ...enTokens(a)]);
  const tb = new Set([...arTokens(b), ...enTokens(b)]);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}
```

- [ ] **Step 4: Run the name tests to verify they pass**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/names.test.ts`
Expected: PASS, two tests. If the transliteration case falls below 0.3, loosen the English token folding rather than the threshold, and keep the stranger case below 0.2.

- [ ] **Step 5: Write the failing load test**

`packages/core/test/madeinsaudi-load.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { extractMembers, loadMembers } from "../src/madeinsaudi/load";

describe("extractMembers", () => {
  test("reads members out of Strapi list payloads of either shape", () => {
    const m = extractMembers([
      [{ id: 1, name: "Kanoo Valves", name_arabic: "كانو للصمامات", products: [{ name: "Ball valves" }], city: "Jubail", website: "https://kanoo.example" }],
      { data: [{ id: 2, attributes: { name: "Gulf Fittings", name_arabic: "الخليج للوصلات", categories: [{ title: "Fittings" }] } }] },
    ]);
    expect(m).toHaveLength(2);
    expect(m[0]).toMatchObject({ id: 1, name: "Kanoo Valves", name_arabic: "كانو للصمامات", products: ["Ball valves"], city: "Jubail" });
    expect(m[1]).toMatchObject({ id: 2, name: "Gulf Fittings", categories: ["Fittings"] });
  });
});

describe.skipIf(!process.env.DATABASE_URL)("loadMembers", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from suppliers where id like 'test:mis%'`;
    await sql`insert into suppliers (id, name_ar, name_en, source, in_tarmeez) values ('test:mis1', 'مصنع كانو للصمامات', 'Kanoo Valves Factory', 'test', true), ('test:mis2', 'مصنع بعيد', 'Far Away Factory', 'test', true)`;
    await sql`insert into products (tariff_code, hs6, title_ar, title_en, source) values ('848180000000', '848180', 'صمامات', 'Valves', 'test') on conflict do nothing`;
    await sql`insert into capabilities (supplier_id, tariff_code, hs6, class) values ('test:mis1', '848180000000', '848180', 'manufacturer')`;
  });
  test("matches a member to a supplier by name and writes tier-1 certification evidence", async () => {
    const r = await loadMembers(sql, [{ id: 9, name: "Kanoo Valves", name_arabic: "كانو للصمامات", products: ["Ball valves"], categories: [], city: null, website: null, raw: {} }]);
    expect(r.matched).toBe(1);
    const [s] = await sql<{ in_made_in_saudi: boolean }[]>`select in_made_in_saudi from suppliers where id = 'test:mis1'`;
    expect(s!.in_made_in_saudi).toBe(true);
    const [far] = await sql<{ in_made_in_saudi: boolean }[]>`select in_made_in_saudi from suppliers where id = 'test:mis2'`;
    expect(far!.in_made_in_saudi).toBe(false);
    const ev = await sql<{ tier: number; source_type: string }[]>`select e.tier, e.source_type from evidence e join capabilities c on c.id = e.capability_id where c.supplier_id = 'test:mis1'`;
    expect(ev).toEqual([{ tier: 1, source_type: "certification" }]);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/madeinsaudi-load.test.ts`
Expected: FAIL with "Cannot find module '../src/madeinsaudi/load'".

- [ ] **Step 7: Implement capture and load**

`packages/core/src/madeinsaudi/load.ts`:

```ts
import type { Sql } from "postgres";
import { nameSimilarity } from "../text/names";

export type Member = { id: string | number; name: string | null; name_arabic: string | null; products: string[]; categories: string[]; city: string | null; website: string | null; raw: unknown };

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const names = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : str((x as { name?: unknown; title?: unknown })?.name ?? (x as { title?: unknown })?.title) ?? "")).filter(Boolean) : []);

export function extractMembers(payloads: unknown[]): Member[] {
  const out: Member[] = [];
  const seen = new Set<string>();
  for (const p of payloads) {
    const list: unknown[] = Array.isArray(p) ? p : Array.isArray((p as { data?: unknown })?.data) ? (p as { data: unknown[] }).data : [];
    for (const item of list) {
      const rec = item as Record<string, unknown>;
      const a = (rec.attributes && typeof rec.attributes === "object" ? { ...(rec.attributes as Record<string, unknown>) } : rec) as Record<string, unknown>;
      const id = (rec.id ?? a.id) as string | number | undefined;
      if (id === undefined || seen.has(String(id))) continue;
      seen.add(String(id));
      out.push({ id, name: str(a.name ?? a.name_en ?? a.title), name_arabic: str(a.name_arabic ?? a.name_ar ?? a.title_ar), products: names(a.products), categories: names(a.categories ?? a.sectors), city: str(a.city ?? (a.city as { name?: unknown })?.name), website: str(a.website ?? a.url), raw: item });
    }
  }
  return out;
}

export async function loadMembers(db: Sql, members: Member[], opts: { threshold?: number } = {}): Promise<{ members: number; matched: number; evidence: number }> {
  const threshold = opts.threshold ?? 0.6;
  const suppliers = await db<{ id: string; name_ar: string | null; name_en: string | null }[]>`select id, name_ar, name_en from suppliers where source <> 'made_in_saudi'`;
  let matched = 0, evidence = 0;
  for (const m of members) {
    const label = [m.name, m.name_arabic].filter(Boolean).join(" ");
    if (!label) continue;
    let best: { id: string; score: number } | null = null;
    for (const s of suppliers) {
      const score = Math.max(m.name_arabic && s.name_ar ? nameSimilarity(m.name_arabic, s.name_ar) : 0, m.name && s.name_en ? nameSimilarity(m.name, s.name_en) : 0, m.name && s.name_ar ? nameSimilarity(m.name, s.name_ar) : 0);
      if (score >= threshold && (!best || score > best.score)) best = { id: s.id, score };
    }
    if (!best) continue;
    matched++;
    const excerpt = `Made in Saudi certified member${m.products.length ? `: ${m.products.slice(0, 8).join(", ")}` : m.categories.length ? `: ${m.categories.slice(0, 5).join(", ")}` : ""}`.slice(0, 300);
    await db.begin(async (tx) => {
      await tx`update suppliers set in_made_in_saudi = true, website = coalesce(website, ${m.website}), raw = coalesce(raw, '{}'::jsonb) || ${tx.json({ made_in_saudi: { id: m.id, match_score: best!.score, name: m.name, name_arabic: m.name_arabic } } as never)}, updated_at = now() where id = ${best!.id}`;
      const caps = await tx<{ id: string }[]>`select id from capabilities where supplier_id = ${best!.id}`;
      for (const c of caps) {
        await tx`delete from evidence where capability_id = ${c.id} and source_type = 'certification' and source_url like 'https://saudimade.sa/%'`;
        await tx`insert into evidence (capability_id, tier, source_type, source_url, excerpt, title) values (${c.id}, 1, 'certification', ${`https://saudimade.sa/en/members#${m.id}`}, ${excerpt}, 'Made in Saudi certification')`;
        evidence++;
      }
    });
  }
  return { members: members.length, matched, evidence };
}
```

`packages/core/src/madeinsaudi/capture.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const REPO_ROOT = join(import.meta.dir, "../../../..");

/** Drive the public members page in a real browser and save every members API response it makes. */
export async function captureMembers(opts: { maxPages?: number; headless?: boolean } = {}): Promise<{ file: string; responses: number }> {
  const outDir = join(REPO_ROOT, "data/raw/saudimade");
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: opts.headless ?? true });
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" });
  const payloads: unknown[] = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (!url.includes("api.saudimade.sa") || !/member/i.test(url)) return;
    try { payloads.push({ url, body: await res.json() }); } catch {}
  });
  await page.goto("https://saudimade.sa/en/members", { waitUntil: "networkidle", timeout: 60_000 });
  const maxPages = opts.maxPages ?? 200;
  for (let i = 0; i < maxPages; i++) {
    const next = page.locator('a[aria-label="Next page"], button[aria-label="Next page"], a:has-text("Next"), button:has-text("Next"), li.next a, a[rel="next"]').first();
    const loadMore = page.locator('button:has-text("Load more"), button:has-text("Show more")').first();
    if (await loadMore.count()) { await loadMore.click(); await page.waitForLoadState("networkidle"); continue; }
    if (!(await next.count()) || (await next.isDisabled().catch(() => false))) break;
    await next.click();
    await page.waitForLoadState("networkidle");
  }
  await browser.close();
  const file = join(outDir, "members.json");
  await writeFile(file, JSON.stringify(payloads));
  return { file, responses: payloads.length };
}
```

`packages/core/scripts/capture-made-in-saudi.ts`:

```ts
import { captureMembers } from "../src/madeinsaudi/capture";
console.log(await captureMembers({ headless: true }));
```

`packages/core/scripts/load-made-in-saudi.ts`:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "../src/db/client";
import { extractMembers, loadMembers } from "../src/madeinsaudi/load";

const file = join(import.meta.dir, "../../../data/raw/saudimade/members.json");
const payloads = (JSON.parse(await readFile(file, "utf8")) as { url: string; body: unknown }[]).map((p) => p.body);
const members = extractMembers(payloads);
console.log(`members extracted: ${members.length}`);
console.log(await loadMembers(sql, members));
await sql.end();
```

Add to the root `package.json` scripts: `"capture:mis": "bun run packages/core/scripts/capture-made-in-saudi.ts"`, `"load:mis": "bun run packages/core/scripts/load-made-in-saudi.ts"`. Install the browser:

```bash
cd packages/core && bun add -d playwright && bunx playwright install chromium && cd ../..
```

- [ ] **Step 8: Run the load test, then capture and load live**

Run: `perl -e 'alarm 120; exec @ARGV' bun test packages/core/test/madeinsaudi-load.test.ts`
Expected: PASS, two tests.

Run: `perl -e 'alarm 900; exec @ARGV' bun run capture:mis && bun run load:mis`
Expected: a members file with at least one response and a positive `matched` count. If the page's pagination controls differ, open `data/raw/saudimade/members.json`, check that at least the first page was captured, and adjust the locator list in `capture.ts` to the control the page actually renders; the load step is independent of how many pages were captured.

- [ ] **Step 9: Typecheck and commit**

```bash
bun run typecheck
git add packages/core/src/text packages/core/src/madeinsaudi packages/core/scripts/capture-made-in-saudi.ts packages/core/scripts/load-made-in-saudi.ts packages/core/test/names.test.ts packages/core/test/madeinsaudi-load.test.ts package.json packages/core/package.json bun.lock
git commit -m "feat(core): Made in Saudi capture through a real browser, name matching and tier-1 evidence"
```

---

### Task 8: The swarm, the hunt and the cost report

**Files:**
- Create: `packages/core/src/detective/hunt.ts`, `packages/core/scripts/swarm.ts`, `packages/core/scripts/hunt.ts`, `packages/core/scripts/cost-report.ts`
- Test: `packages/core/test/swarm.test.ts`

**Interfaces:**
- Produces: `selectSwarmSuppliers(db, { limit, headings }): Promise<{ id: string; n: number }[]>` ordered by sector capability count desc, only `detective_status = 'pending'`; `selectAuditTargets(db, { limit, headings }): Promise<string[]>` capabilities in the headings whose supplier's detective ran ok and which have no audit yet, evidence-rich first; `runHunt(db, family: "valve" | "pump" | "fitting"): Promise<{ queries: number; candidates: number; created: number }>`; `costReport(db): Promise<Row[]>` with per-role averages.

- [ ] **Step 1: Write the failing selection tests**

`packages/core/test/swarm.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { selectAuditTargets, selectSwarmSuppliers } from "../scripts/swarm";

describe.skipIf(!process.env.DATABASE_URL)("swarm selection", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from suppliers where id like 'test:sw%'`;
    await sql`insert into products (tariff_code, hs6, title_ar, title_en, source) values ('848180000000', '848180', 'صمامات', 'Valves', 'test'), ('841370000000', '841370', 'مضخات', 'Pumps', 'test'), ('040310000000', '040310', 'زبادي', 'Yogurt', 'test') on conflict do nothing`;
    await sql`insert into suppliers (id, name_ar, source, in_tarmeez, detective_status) values ('test:sw1', 'أ', 'test', true, 'pending'), ('test:sw2', 'ب', 'test', true, 'pending'), ('test:sw3', 'ج', 'test', true, 'ok')`;
    await sql`insert into capabilities (supplier_id, tariff_code, hs6, class) values ('test:sw1', '848180000000', '848180', 'manufacturer'), ('test:sw1', '841370000000', '841370', 'manufacturer'), ('test:sw2', '848180000000', '848180', 'manufacturer'), ('test:sw2', '040310000000', '040310', 'manufacturer'), ('test:sw3', '848180000000', '848180', 'manufacturer')`;
  });
  test("orders pending suppliers by sector capability count", async () => {
    const rows = (await selectSwarmSuppliers(sql, { limit: 50, headings: ["8481", "8413", "7307"] })).filter((r) => r.id.startsWith("test:sw"));
    expect(rows.map((r) => r.id)).toEqual(["test:sw1", "test:sw2"]);
    expect(rows[0]!.n).toBe(2);
  });
  test("audit targets are sector capabilities of investigated suppliers without an audit", async () => {
    const ids = await selectAuditTargets(sql, { limit: 500, headings: ["8481"] });
    const [cap] = await sql<{ id: string }[]>`select id from capabilities where supplier_id = 'test:sw3'`;
    expect(ids).toContain(cap!.id);
    const [pending] = await sql<{ id: string }[]>`select id from capabilities where supplier_id = 'test:sw1' and hs6 = '848180'`;
    expect(ids).not.toContain(pending!.id);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `perl -e 'alarm 60; exec @ARGV' bun test packages/core/test/swarm.test.ts`
Expected: FAIL with "Cannot find module '../scripts/swarm'".

- [ ] **Step 3: Implement the swarm, the hunt and the report**

`packages/core/scripts/swarm.ts`:

```ts
import pLimit from "p-limit";
import type { Sql } from "postgres";
import { runAuditor } from "../src/auditor/run";
import { runDetective } from "../src/detective/run";

export const SECTOR_HEADINGS = ["8481", "8413", "7307"];

export async function selectSwarmSuppliers(db: Sql, opts: { limit: number; headings: string[] }): Promise<{ id: string; n: number }[]> {
  const like = opts.headings.map((h) => `${h}%`);
  return db<{ id: string; n: number }[]>`
    select s.id, count(*)::int as n
    from suppliers s join capabilities c on c.supplier_id = s.id
    where s.detective_status = 'pending' and c.hs6 like any(${like})
    group by s.id order by n desc, s.id limit ${opts.limit}`;
}

export async function selectAuditTargets(db: Sql, opts: { limit: number; headings: string[] }): Promise<string[]> {
  const like = opts.headings.map((h) => `${h}%`);
  const rows = await db<{ id: string }[]>`
    select c.id
    from capabilities c join suppliers s on s.id = c.supplier_id
    left join (select capability_id, count(*) as n, min(tier) as best from evidence group by capability_id) e on e.capability_id = c.id
    where s.detective_status = 'ok' and c.audit_run_id is null and c.hs6 like any(${like})
    order by coalesce(e.best, 9), coalesce(e.n, 0) desc, c.created_at limit ${opts.limit}`;
  return rows.map((r) => r.id);
}

if (import.meta.main) {
  const { sql } = await import("../src/db/client");
  const args = process.argv.slice(2);
  const opt = (name: string, def: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] ?? def : def; };
  const limit = Number(opt("limit", "60"));
  const stage = opt("stage", "both");
  const concurrency = Number(opt("concurrency", "2"));
  const started = Date.now();
  if (stage === "detective" || stage === "both") {
    const targets = await selectSwarmSuppliers(sql, { limit, headings: SECTOR_HEADINGS });
    console.log(`detectives: ${targets.length} suppliers`);
    const limitRun = pLimit(concurrency);
    let done = 0, failed = 0;
    await Promise.all(targets.map((t) => limitRun(async () => {
      try { const r = await runDetective(sql, t.id); done++; console.log(`[${done}/${targets.length}] ${t.id} caps=${r.merged.capabilities} evidence=${r.merged.evidence} same=${r.findings.is_same_company}`); }
      catch (err) { failed++; console.error(`${t.id} failed: ${(err as Error).message}`); }
    })));
    console.log(`detectives done: ${done}, failed: ${failed}, ${((Date.now() - started) / 60000).toFixed(1)} min`);
  }
  if (stage === "auditor" || stage === "both") {
    const targets = await selectAuditTargets(sql, { limit: limit * 6, headings: SECTOR_HEADINGS });
    console.log(`auditors: ${targets.length} capabilities`);
    const limitRun = pLimit(concurrency);
    let done = 0, failed = 0; const tally: Record<string, number> = {};
    await Promise.all(targets.map((id) => limitRun(async () => {
      try { const r = await runAuditor(sql, id); done++; tally[r.verdict] = (tally[r.verdict] ?? 0) + 1; if (done % 10 === 0) console.log(`[${done}/${targets.length}] verdicts ${JSON.stringify(tally)}`); }
      catch (err) { failed++; console.error(`${id} failed: ${(err as Error).message}`); }
    })));
    console.log(`auditors done: ${done}, failed: ${failed}, verdicts ${JSON.stringify(tally)}, ${((Date.now() - started) / 60000).toFixed(1)} min`);
  }
  await sql.end();
}
```

`packages/core/src/detective/hunt.ts`:

```ts
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { Sql } from "postgres";
import { z } from "zod";
import { getChatModel, modelRefFor } from "../models/registry";
import { invokeStructured } from "../models/structured";
import { nameSimilarity } from "../text/names";
import { withRun } from "../trajectory/handler";
import { addStep } from "../trajectory/store";
import { searchTavily } from "../web/tavily";

export const HUNT_QUERIES: Record<"valve" | "pump" | "fitting", string[]> = {
  valve: ["مصنع صمامات في السعودية", "valve manufacturer Saudi Arabia factory Dammam Jubail Riyadh", "مصانع الصمامات الصناعية المملكة العربية السعودية قائمة"],
  pump: ["مصنع مضخات في السعودية", "pump manufacturer Saudi Arabia factory", "مصانع المضخات السعودية"],
  fitting: ["مصنع وصلات ومواسير في السعودية فلنجات", "pipe fittings flanges manufacturer Saudi Arabia factory", "مصانع الفلنجات والوصلات السعودية"],
};

const Candidates = z.object({ companies: z.array(z.object({ name: z.string(), name_arabic: z.string().nullable(), url: z.string().nullable(), city: z.string().nullable(), what: z.string().describe("one line: what the page says they make or sell"), is_manufacturer_claim: z.boolean() })) });
const CandidatesLoose: z.ZodType<z.infer<typeof Candidates>> = z.preprocess((raw) => {
  const r = raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  const list = Array.isArray(r.companies) ? r.companies : [];
  return { companies: list.map((c) => { const x = (c ?? {}) as Record<string, unknown>; return { name: String(x.name ?? "").trim(), name_arabic: x.name_arabic ? String(x.name_arabic) : null, url: x.url ? String(x.url) : null, city: x.city ? String(x.city) : null, what: String(x.what ?? ""), is_manufacturer_claim: x.is_manufacturer_claim === true || String(x.is_manufacturer_claim) === "true" }; }).filter((c) => c.name) };
}, Candidates);

export async function runHunt(db: Sql, family: "valve" | "pump" | "fitting"): Promise<{ queries: number; candidates: number; created: number }> {
  return withRun(db, { role: "detective", inputRef: `hunt:${family}`, model: modelRefFor("detective") }, async (runId, handler) => {
    const results = [];
    for (const q of HUNT_QUERIES[family]) {
      const t = Date.now();
      const r = await searchTavily(q, { maxResults: 8 });
      results.push(...r);
      await addStep(db, runId, { kind: "retrieval", name: "tavily_search", input: { query: q }, output: r.map((x) => x.url), durationMs: Date.now() - t });
    }
    const text = results.map((r, i) => `### ${i + 1}. ${r.title}\nURL: ${r.url}\n${(r.raw_content ?? r.content).slice(0, 2500)}`).join("\n\n").slice(0, 16_000);
    const found = await invokeStructured(getChatModel("detective"), [
      new SystemMessage(`You extract company names from search results. List every Saudi company these pages say makes or sells ${family}s. One entry per company, Arabic name if shown, the URL of the page that mentions it, the city if stated. Do not invent companies. /no_think`),
      new HumanMessage(text),
    ], { name: "hunt_candidates", toolSchema: Candidates, parseSchema: CandidatesLoose, config: { callbacks: [handler], runName: "hunt_extract" } });
    const known = await db<{ id: string; name_ar: string | null; name_en: string | null }[]>`select id, name_ar, name_en from suppliers`;
    let created = 0;
    for (const c of found.companies) {
      const dup = known.find((k) => Math.max(k.name_en ? nameSimilarity(c.name, k.name_en) : 0, k.name_ar && c.name_arabic ? nameSimilarity(c.name_arabic, k.name_ar) : 0, k.name_ar ? nameSimilarity(c.name, k.name_ar) : 0) >= 0.6);
      if (dup) continue;
      const id = `hunt:${family}:${c.name.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, "-").slice(0, 60)}`;
      const [row] = await db<{ inserted: boolean }[]>`
        insert into suppliers (id, name_ar, name_en, city_en, website, source, in_tarmeez, summary, raw)
        values (${id}, ${c.name_arabic}, ${c.name}, ${c.city}, ${c.url && /^https?:/.test(c.url) ? c.url : null}, 'hunt', false, ${c.what}, ${db.json({ hunt: { family, runId, ...c } } as never)})
        on conflict (id) do nothing returning true as inserted`;
      if (row?.inserted) { created++; known.push({ id, name_ar: c.name_arabic, name_en: c.name }); }
    }
    await addStep(db, runId, { kind: "note", name: "hunt_result", output: { candidates: found.companies.length, created } });
    return { queries: HUNT_QUERIES[family].length, candidates: found.companies.length, created };
  });
}
```

`packages/core/scripts/hunt.ts`:

```ts
import { sql } from "../src/db/client";
import { runHunt } from "../src/detective/hunt";
import { runDetective } from "../src/detective/run";

for (const family of ["valve", "pump", "fitting"] as const) console.log(family, await runHunt(sql, family));
const found = await sql<{ id: string }[]>`select id from suppliers where source = 'hunt' and detective_status = 'pending' order by id`;
console.log(`running detectives on ${found.length} discovered suppliers`);
for (const s of found) { try { const r = await runDetective(sql, s.id); console.log(s.id, r.merged); } catch (err) { console.error(s.id, (err as Error).message); } }
await sql.end();
```

`packages/core/scripts/cost-report.ts`:

```ts
import { sql } from "../src/db/client";

const PRICES: Record<string, { input: number; output: number }> = { "claude-opus-5": { input: 5, output: 25 }, "claude-sonnet-5": { input: 2, output: 10 }, local: { input: 0, output: 0 } };
const rows = await sql<{ role: string; runs: number; ok: number; avg_s: number; tok_in: number; tok_out: number }[]>`
  select r.role, count(distinct r.id)::int as runs, count(distinct r.id) filter (where r.status = 'ok')::int as ok,
         avg(extract(epoch from (r.finished_at - r.started_at)))::float as avg_s,
         (sum(s.tokens_in)::float / greatest(count(distinct r.id), 1)) as tok_in, (sum(s.tokens_out)::float / greatest(count(distinct r.id), 1)) as tok_out
  from runs r left join run_steps s on s.run_id = r.id and s.kind = 'llm_call'
  where r.input_ref not like 'test%' group by r.role order by r.role`;
console.log("role         runs   ok   avg s   tok in   tok out   $/run opus5   $/run sonnet5");
for (const r of rows) {
  const cost = (p: { input: number; output: number }) => ((r.tok_in ?? 0) * p.input + (r.tok_out ?? 0) * p.output) / 1e6;
  console.log(`${r.role.padEnd(12)} ${String(r.runs).padStart(5)} ${String(r.ok).padStart(4)} ${(r.avg_s ?? 0).toFixed(0).padStart(6)} ${Math.round(r.tok_in ?? 0).toString().padStart(8)} ${Math.round(r.tok_out ?? 0).toString().padStart(9)} ${cost(PRICES["claude-opus-5"]!).toFixed(3).padStart(12)} ${cost(PRICES["claude-sonnet-5"]!).toFixed(3).padStart(14)}`);
}
const [c] = await sql<{ suppliers: number; supported: number; refuted: number; pending: number; discovered: number; t1: number; t2: number; t3: number }[]>`
  select (select count(*) from suppliers where detective_status = 'ok')::int as suppliers,
         (select count(*) from capabilities where verdict = 'supported')::int as supported,
         (select count(*) from capabilities where verdict = 'refuted')::int as refuted,
         (select count(*) from capabilities where audit_run_id is not null and verdict = 'pending')::int as pending,
         (select count(*) from suppliers where source = 'hunt')::int as discovered,
         (select count(*) from evidence where tier = 1)::int as t1, (select count(*) from evidence where tier = 2)::int as t2, (select count(*) from evidence where tier = 3)::int as t3`;
console.log("\ninvestigated suppliers:", c!.suppliers, "| verdicts supported/refuted/pending:", c!.supported, c!.refuted, c!.pending, "| discovered suppliers:", c!.discovered, "| evidence tier 1/2/3:", c!.t1, c!.t2, c!.t3);
await sql.end();
```

Add to the root `package.json` scripts: `"swarm": "bun run packages/core/scripts/swarm.ts"`, `"hunt": "bun run packages/core/scripts/hunt.ts"`, `"cost": "bun run packages/core/scripts/cost-report.ts"`.

- [ ] **Step 4: Run the selection test, then a small swarm, then the hunt**

Run: `perl -e 'alarm 120; exec @ARGV' bun test packages/core/test/swarm.test.ts`
Expected: PASS, two tests.

Run: `bun run swarm --limit 3 --stage both`
Expected: three detective lines, then auditor lines with a verdict tally; then `bun run cost` prints a per-role table.

Then launch the real batch detached and keep building: `nohup bun run swarm --limit 60 --stage both > <scratch>/swarm.log 2>&1 &`, and `bun run hunt` after it, since both hold Ollama.

- [ ] **Step 5: Typecheck and commit**

```bash
bun run typecheck
git add packages/core/src/detective/hunt.ts packages/core/scripts/swarm.ts packages/core/scripts/hunt.ts packages/core/scripts/cost-report.ts packages/core/test/swarm.test.ts package.json
git commit -m "feat(core): resumable swarm, long-tail hunt and cost report"
```

---

### Task 9: Record what was measured

**Files:**
- Modify: `FACTS.md` section 2, `docs/adr/0001` consequences, `BUILD_PLAN.md` Hour 8 to 16, `packages/core/README.md`

- [ ] **Step 1: After the swarm batch finishes, run the report and record it**

Run: `bun run cost`

Append to `FACTS.md` section 2 a bullet with the real numbers in this shape: "Detective and Auditor swarm, measured YYYY-MM-DD: N suppliers investigated, S capabilities supported, R refuted, P pending; discovered suppliers D; average X seconds per detective run and Y per audit on qwen3.5:9b; at Claude Opus 5 prices a detective run would cost about $A and an audit $B." Note in `docs/adr/0001` consequences that pg-boss is deferred: the swarm is a resumable script because one local Ollama serialises every call. Add the new commands to `packages/core/README.md`.

- [ ] **Step 2: Commit**

```bash
git add FACTS.md docs/adr/0001-one-postgres-for-graph-vectors-queue-and-checkpoints.md BUILD_PLAN.md packages/core/README.md
git commit -m "docs: milestone-2 measurements and pg-boss deferral"
```

---

## Self-review

**Spec coverage.** BUILD_PLAN Hour 8 to 16: Detective agent with search, fetch, certifications, catalogues and capacity signals, Tasks 2 to 4; Auditor with three lenses, kill on real or spec, classify on local, Task 5; MLCP CR merge (Hour 2 to 8 item 2), Task 6; Made in Saudi certified flag (item 3), Task 7; long-tail discovery and discovery lift, Task 8; scope discipline and the measured cost the pitch needs, Tasks 8 and 9. CONTEXT terms: Supplier, Capability, Class, Evidence tier, Verdict, Supported capability all land in columns and mappings. ADR 0004 is reused for every structured call. Etimad awards stay on the kill list.

**Placeholder scan.** Every code step is a full file. The two conditional notes are the Playwright locator adjustment in Task 7 and the name-folding note in Task 7 step 4, each naming the exact file.

**Type consistency.** `SupplierProfile` is defined in `queries.ts` and consumed by `select.ts`, `persist.ts` and `run.ts`; `PageCandidate` from `select.ts` is consumed by `persist.ts` and `run.ts`; `DetectiveFindingsT` from `schema.ts` by `persist.ts` and `run.ts`; `AuditVerdictT` from `auditor/schema.ts` by `verdict.ts` and `run.ts`; `Member` from `madeinsaudi/load.ts` by its script; `nameSimilarity` from `text/names.ts` by `madeinsaudi/load.ts` and `detective/hunt.ts`. Column names match `0004_enrichment.sql` and the milestone-1 migrations.
