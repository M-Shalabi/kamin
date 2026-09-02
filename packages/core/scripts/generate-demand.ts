import { sql } from "../src/db/client";
import { generateDemand } from "../src/demand/generate";

const seed = Number(process.argv[2] ?? "2026");
const lines = Number(process.argv[3] ?? "96");
const imports = await sql<{ hs6: string; value_usd: number }[]>`select hs6, value_usd::float as value_usd from imports where year = 2024`;
const rows = generateDemand(seed, imports, { lines });
let inserted = 0;
for (const r of rows) {
  const [row] = await sql<{ inserted: boolean }[]>`
    insert into demand_lines (raw_text, portco, source_system, qty, qty_unit, history_factor, annual_value_usd, seed_hs6, simulated, line_key)
    values (${r.raw_text}, ${r.portco}, ${r.source_system}, ${r.qty}, ${r.qty_unit}, ${r.history_factor}, ${r.annual_value_usd}, ${r.seed_hs6}, true, ${r.line_key})
    on conflict (line_key) do nothing returning true as inserted`;
  if (row?.inserted) inserted++;
}
console.log(`demand lines generated: ${rows.length}, inserted: ${inserted}, annual value USD ${(rows.reduce((s, r) => s + r.annual_value_usd, 0) / 1e6).toFixed(1)} M`);
await sql.end();
