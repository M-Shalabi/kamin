import { sql } from "../src/db/client";
import { runCoordinator } from "../src/coordinator/run";
import { poolAndPersist } from "../src/demand/pool";

const limit = Number(process.argv[2] ?? "1000");
const pending = await sql<{ id: string; raw_text: string; portco: string; source_system: string | null }[]>`
  select id, raw_text, portco, source_system from demand_lines where simulated and hs6 is null and line_key not like 'test:%' order by created_at limit ${limit}`;
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
