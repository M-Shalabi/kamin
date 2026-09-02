import { sql } from "../src/db/client";
import { runAdvisor } from "../src/advisor/run";

const limit = Number(process.argv[2] ?? "50");
const gaps = await sql<{ id: string; title: string }[]>`select o.id, o.title from pooled_orders o left join gap_cases g on g.pooled_order_id = o.id where o.gap_kind in ('manufacturing_gap', 'supply_gap') and g.pooled_order_id is null and o.title not like 'test %' order by o.annual_value_usd desc nulls last limit ${limit}`;
console.log(`gaps without a case (manufacturing and supply): ${gaps.length}`);
for (const g of gaps) { try { const r = await runAdvisor(sql, g.id); console.log(`${g.title}: ${r.case.headline} (${r.case.pivot_candidates.length} pivots)`); } catch (err) { console.error(g.id, (err as Error).message); } }
await sql.end();
