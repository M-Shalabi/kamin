/** Prints docs/numbers.md: every number the demo says out loud, as measured, with the query that produced it. */
import { sql } from "../src/db/client";
import { coverage } from "../src/match/coverage";
import { PORTFOLIO_IMPORT_SHARE } from "../src/demand/generate";

const SECTOR = "left(hs6, 4) in ('8481', '8413', '7307')";
const one = async <T = number>(q: string): Promise<T> => (await sql.unsafe(q))[0]!.v as T;
const rows: { what: string; value: string; source: string }[] = [];
const add = async (what: string, q: string, fmt: (v: number) => string = (v) => Number(v).toLocaleString("en-US")) => rows.push({ what, value: fmt(await one(q)), source: q });
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const usd = (v: number) => `USD ${Math.round(v).toLocaleString("en-US")}`;

await add("Suppliers on the map", "select count(*) as v from suppliers where id not like 'test:%'");
await add("… declared in Tarmeez", "select count(*) as v from suppliers where in_tarmeez and id not like 'test:%'");
await add("… in the Madinah chamber directory (MLCP)", "select count(*) as v from suppliers where in_mlcp");
await add("… Made in Saudi certified", "select count(*) as v from suppliers where in_made_in_saudi");
await add("… absent from Tarmeez (found through MLCP, Made in Saudi or the hunt)", "select count(*) as v from suppliers where not in_tarmeez and id not like 'test:%'");
await add("… discovered by the long-tail hunt, in no registry", "select count(*) as v from suppliers where source = 'hunt'");
await add("Suppliers with a capability in the valve, pump and fitting slice", `select count(distinct supplier_id) as v from capabilities where ${SECTOR} and supplier_id not like 'test:%'`);
await add("Capabilities on the map", "select count(*) as v from capabilities where supplier_id not like 'test:%'");
await add("… in the slice", `select count(*) as v from capabilities where ${SECTOR} and supplier_id not like 'test:%'`);
await add("Distinct tariff codes with a registered product (Tarmeez)", "select count(*) as v from products");
for (const t of [1, 2, 3, 4]) await add(`Evidence records, Tier ${t}`, `select count(*) as v from evidence e join capabilities c on c.id = e.capability_id where e.tier = ${t} and c.supplier_id not like 'test:%'`);
await add("Suppliers investigated by a Detective", "select count(*) as v from suppliers where detective_status = 'ok' and id not like 'test:%'");
await add("… Detective runs that errored", "select count(*) as v from suppliers where detective_status = 'error'");
await add("Slice capabilities audited", `select count(*) as v from capabilities where audit_run_id is not null and ${SECTOR}`);
await add("… supported", `select count(*) as v from capabilities where verdict = 'supported' and ${SECTOR}`);
await add("… refuted", `select count(*) as v from capabilities where verdict = 'refuted' and ${SECTOR}`);
await add("… still pending after audit", `select count(*) as v from capabilities where audit_run_id is not null and verdict = 'pending' and ${SECTOR}`);
await add("Supported capabilities backed by Tier 1 or 2 (count toward coverage)", `select count(*) as v from capabilities c where c.verdict = 'supported' and ${SECTOR} and exists (select 1 from evidence e where e.capability_id = c.id and e.tier <= 2)`);
await add("Supported by class: manufacturer", `select count(*) as v from capabilities where verdict = 'supported' and class = 'manufacturer' and ${SECTOR}`);
await add("Supported by class: assembler", `select count(*) as v from capabilities where verdict = 'supported' and class = 'assembler' and ${SECTOR}`);
await add("Supported by class: authorised distributor", `select count(*) as v from capabilities where verdict = 'supported' and class = 'authorised_distributor' and ${SECTOR}`);
await add("Supported by class: trader", `select count(*) as v from capabilities where verdict = 'supported' and class = 'trader' and ${SECTOR}`);
for (const h of ["8481", "8413", "7307"]) await add(`Saudi imports, HS ${h}, latest Comtrade year`, `select coalesce(sum(value_usd), 0) as v from imports where left(hs6, 4) = '${h}' and year = (select max(year) from imports)`, usd);
await add("Comtrade year used", "select max(year) as v from imports", String);
rows.push({ what: "Portfolio share of national imports assumed for the simulated demand", value: pct(PORTFOLIO_IMPORT_SHARE), source: "PORTFOLIO_IMPORT_SHARE in packages/core/src/demand/generate.ts" });
await add("Simulated demand lines", "select count(*) as v from demand_lines where simulated");
await add("Portfolio companies named", "select count(distinct portco) as v from demand_lines where simulated");
await add("Annual value of the simulated demand", "select coalesce(sum(annual_value_usd), 0) as v from demand_lines where simulated", usd);
await add("Demand lines resolved by the Coordinator to an HS anchor", "select count(*) as v from demand_lines where simulated and hs6 is not null");
await add("Demand lines pooled into orders", "select count(*) as v from demand_lines where simulated and pooled_order_id is not null");
await add("Pooled orders", "select count(*) as v from pooled_orders where title not like 'test %'");
await add("… covered (a supported manufacturer or assembler at spec, Tier 1 or 2)", "select count(*) as v from pooled_orders where gap_kind = 'covered' and title not like 'test %'");
await add("… manufacturing gaps (supplied locally, nobody manufactures it)", "select count(*) as v from pooled_orders where gap_kind = 'manufacturing_gap' and title not like 'test %'");
await add("… supply gaps (no supported capability of any class)", "select count(*) as v from pooled_orders where gap_kind = 'supply_gap' and title not like 'test %'");
const cov = await coverage(sql);
rows.push({ what: "Coverage at the stated specification, spend-weighted share of pooled annual demand (the headline figure)", value: pct(cov.coverage_spec), source: "packages/core/src/match/coverage.ts (bun run coverage)" });
rows.push({ what: "… orders covered at the stated specification", value: pct(cov.line_coverage_spec), source: "same" });
rows.push({ what: "Category-level coverage: a verified supplier declares the subheading with nothing in conflict, spec unverified", value: pct(cov.coverage), source: "same" });
rows.push({ what: "… orders covered at category level", value: pct(cov.line_coverage), source: "same" });
await add("Orders with a supplier only at category level (the Detectives' next queue)", "select count(*) as v from pooled_orders where spec_status = 'category' and title not like 'test %'");
await add("Annual value in manufacturing gaps", "select coalesce(sum(annual_value_usd), 0) as v from pooled_orders where gap_kind = 'manufacturing_gap' and title not like 'test %'", usd);
await add("Annual value in supply gaps", "select coalesce(sum(annual_value_usd), 0) as v from pooled_orders where gap_kind = 'supply_gap' and title not like 'test %'", usd);
await add("Gaps on the announced Mandatory List tranche", "select count(*) as v from pooled_orders where gap_kind <> 'covered' and mandatory and title not like 'test %'");
await add("Investment cases written by the Advisor", "select count(*) as v from gap_cases");
await add("Matches written", "select count(*) as v from matches m join pooled_orders o on o.id = m.pooled_order_id where o.title not like 'test %'");
await add("Discovery lift: pooled orders whose best match is a supplier absent from Tarmeez", "select count(distinct m.pooled_order_id) as v from matches m join capabilities c on c.id = m.capability_id join suppliers s on s.id = c.supplier_id join pooled_orders o on o.id = m.pooled_order_id where m.rank = 1 and not s.in_tarmeez and o.title not like 'test %'");
const perf = await sql<{ role: string; runs: number; avg_s: number; tok_in: number; tok_out: number }[]>`
  select r.role, count(distinct r.id)::int as runs, avg(extract(epoch from (r.finished_at - r.started_at)))::float as avg_s,
         coalesce(sum(s.tokens_in), 0)::float / greatest(count(distinct r.id), 1) as tok_in, coalesce(sum(s.tokens_out), 0)::float / greatest(count(distinct r.id), 1) as tok_out
  from runs r left join run_steps s on s.run_id = r.id where r.status = 'ok' group by r.role order by r.role`;
for (const p of perf) rows.push({ what: `${p.role}: seconds per run on ${process.env[`${p.role.toUpperCase()}_MODEL`] ?? "ollama:qwen3.5:9b"} (${p.runs} runs)`, value: `${p.avg_s.toFixed(0)} s, ${Math.round(p.tok_in).toLocaleString("en-US")} tokens in, ${Math.round(p.tok_out).toLocaleString("en-US")} out`, source: "runs and run_steps (bun run cost)" });

console.log(`# Numbers as measured\n\nGenerated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC by \`bun run numbers\` from the live database. Regenerate after any run; never edit the values by hand.\n`);
console.log("| Number | Value | Produced by |\n|---|---|---|");
for (const r of rows) console.log(`| ${r.what} | ${r.value} | \`${r.source.replace(/\s+/g, " ")}\` |`);
console.log(`
## Reconciliation with the deliverables' older figures

- **14,873 plants in the Tarmeez catalogue API** against the **12,946 operating factories** headline: the catalogue holds every registered plant, including traders and non-operating ones, so the two populations differ by definition. Say "14,873 registered plants" for the map and pin 12,946 to its Ministry source before using it.
- **59,611 product registrations** collapse to the distinct tariff codes above; the old 52,824 (Arabic view) and 12,641 (English view) counts are retired.
- **Coverage** is spend-weighted over the simulated demand, which is anchored on Comtrade values at the portfolio share above. It is a property of this demand set, not a national statistic.
- **Seconds per run** are on a 16 GB laptop with one local Ollama serialising every call. Paid-model cost per run is printed by \`bun run cost\`.
`);
await sql.end();
