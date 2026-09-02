import { sql } from "../src/db/client";
import { coverage } from "../src/match/coverage";
const c = await coverage(sql);
console.log(`coverage at spec: ${(c.coverage_spec * 100).toFixed(1)}% of USD ${(c.spend_total / 1e6).toFixed(1)}M (${(c.line_coverage_spec * 100).toFixed(1)}% of ${c.line_total} pooled orders) | category level: ${(c.coverage * 100).toFixed(1)}% of spend, ${(c.line_coverage * 100).toFixed(1)}% of orders | manufacturing gaps: ${c.manufacturing_gaps} | supply gaps: ${c.supply_gaps}`);
const [d] = await sql<{ discovered: number; supported_discovered: number }[]>`select (select count(*) from suppliers where source in ('hunt', 'made_in_saudi', 'mlcp') and not in_tarmeez)::int as discovered, (select count(distinct c.supplier_id) from capabilities c join suppliers s on s.id = c.supplier_id where s.source in ('hunt','made_in_saudi','mlcp') and not s.in_tarmeez and c.verdict = 'supported')::int as supported_discovered`;
console.log(`discovery lift: ${d!.supported_discovered} supported suppliers outside Tarmeez (${d!.discovered} candidates)`);
await sql.end();
