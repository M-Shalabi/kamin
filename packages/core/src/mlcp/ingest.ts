import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Sql } from "postgres";
import { lastPageNumber, parseDetailPage, parseListPage } from "./parse";

import { REPO_ROOT } from "../paths";
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
        const [ins] = await db<{ inserted: boolean }[]>`
          insert into suppliers (id, name_ar, cr_number, city_ar, region_en, source, in_mlcp, raw)
          values (${`mlcp:${row.cr}`}, ${detail?.name ?? row.name}, ${row.cr}, ${detail?.address ?? null}, 'Madinah Region', 'mlcp', true, ${db.json({ mlcp: raw } as never)})
          on conflict (id) do update set name_ar = excluded.name_ar, raw = excluded.raw, in_mlcp = true, updated_at = now()
          returning (xmax = 0) as inserted`;
        if (ins?.inserted) created++;
      }
    }
  }
  return { pages, factories, matched, created };
}
