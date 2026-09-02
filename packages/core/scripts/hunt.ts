import { sql } from "../src/db/client";
import { runHunt } from "../src/detective/hunt";
import { runDetective } from "../src/detective/run";

for (const family of ["valve", "pump", "fitting"] as const) console.log(family, await runHunt(sql, family));
const found = await sql<{ id: string }[]>`select id from suppliers where source = 'hunt' and detective_status = 'pending' order by id`;
console.log(`running detectives on ${found.length} discovered suppliers`);
for (const s of found) { try { const r = await runDetective(sql, s.id); console.log(s.id, r.merged); } catch (err) { console.error(s.id, (err as Error).message); } }
await sql.end();
