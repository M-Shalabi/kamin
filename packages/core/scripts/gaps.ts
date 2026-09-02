import { sql } from "../src/db/client";
const rows = await sql<{ title: string; hs6: string; gap_kind: string; mandatory: boolean; annual_value_usd: number; portco_count: number; pivots: number | null; headline: string | null }[]>`
  select o.title, o.hs6, o.gap_kind, o.mandatory, o.annual_value_usd::float as annual_value_usd, o.portco_count, jsonb_array_length(g."case"->'pivot_candidates') as pivots, g."case"->>'headline' as headline
  from pooled_orders o left join gap_cases g on g.pooled_order_id = o.id where o.gap_kind <> 'covered' and o.title not like 'test %' order by o.gap_kind, o.annual_value_usd desc nulls last`;
console.log("gap kind            mandatory  USD/yr        portcos  pivots  title / headline");
for (const r of rows) console.log(`${r.gap_kind.padEnd(19)} ${(r.mandatory ? "yes" : "no").padEnd(10)} ${Math.round(r.annual_value_usd ?? 0).toLocaleString("en-US").padStart(12)}  ${String(r.portco_count).padStart(7)}  ${String(r.pivots ?? "-").padStart(6)}  ${r.title}${r.headline ? " / " + r.headline : ""}`);
await sql.end();
