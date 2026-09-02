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
