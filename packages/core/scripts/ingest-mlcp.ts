import { sql } from "../src/db/client";
import { ingestMlcp } from "../src/mlcp/ingest";

console.log(await ingestMlcp(sql));
const [row] = await sql<{ n: number; m: number }[]>`select count(*) filter (where source = 'mlcp')::int as n, count(*) filter (where in_mlcp and source <> 'mlcp')::int as m from suppliers`;
console.log(`mlcp-only suppliers: ${row!.n}, tarmeez suppliers also in MLCP: ${row!.m}`);
await sql.end();
