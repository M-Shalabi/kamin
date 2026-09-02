import { sql } from "../src/db/client";

const PRICES: Record<string, { input: number; output: number }> = { "claude-opus-5": { input: 5, output: 25 }, "claude-sonnet-5": { input: 2, output: 10 } };
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
