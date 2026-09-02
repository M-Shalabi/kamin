import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Sql } from "postgres";

import { REPO_ROOT } from "../paths";
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
