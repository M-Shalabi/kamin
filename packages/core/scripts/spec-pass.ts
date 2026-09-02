/**
 * The specification pass: run the Specifier over the supported suppliers that could close the most
 * pooled demand, most valuable subheadings first, own-website suppliers first within a subheading.
 * Usage: bun run spec:pass [limit] [--hs6 848180]
 */
import { sql } from "../src/db/client";
import { runSpecifier } from "../src/detective/spec";

const args = process.argv.slice(2);
const limit = Number(args.find((a) => /^\d+$/.test(a)) ?? "20");
const hs6Arg = args.indexOf("--hs6") >= 0 ? args[args.indexOf("--hs6") + 1] : null;
const targets = await sql<{ id: string; name: string | null; website: string | null; usd: number; hs6s: string[] }[]>`
  with demand as (select hs6, sum(annual_value_usd) as usd from pooled_orders where title not like 'test %' ${hs6Arg ? sql`and hs6 = ${hs6Arg}` : sql``} group by hs6)
  select s.id, coalesce(s.name_en, s.name_ar) as name, s.website, sum(d.usd)::float as usd, array_agg(distinct c.hs6) as hs6s
  from capabilities c join suppliers s on s.id = c.supplier_id join demand d on d.hs6 = c.hs6
  where c.verdict = 'supported' and s.id not like 'test:%'
    and not exists (select 1 from runs r where r.role = 'specifier' and r.input_ref = s.id and r.status = 'ok')
  group by s.id, s.name_en, s.name_ar, s.website
  order by (s.website is not null) desc, usd desc limit ${limit}`;
console.log(`specifier: ${targets.length} suppliers, ${targets.filter((t) => t.website).length} with a website`);
const started = Date.now(); let attributed = 0, evidence = 0, failed = 0;
for (const [i, t] of targets.entries()) {
  try {
    const r = await runSpecifier(sql, t.id, { hs6s: t.hs6s });
    attributed += r.merged.attributed; evidence += r.merged.evidence;
    console.log(`[${i + 1}/${targets.length}] ${t.id} ${t.name ?? ""}: products=${r.merged.products} attributed=${r.merged.attributed} evidence=${r.merged.evidence} same=${r.findings.is_same_company} (closable USD ${Math.round(t.usd / 1e6)}M)`);
  } catch (err) { failed++; console.error(`${t.id} failed: ${(err as Error).message}`); }
}
console.log(`specifier done: ${attributed} capabilities attributed, ${evidence} evidence records, ${failed} failed, ${((Date.now() - started) / 60000).toFixed(1)} min`);
await sql.end();
