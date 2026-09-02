/** Recomputes the tier of every Detective-written evidence record from its host (classifyUrl) and the supplier's own domains. No model calls. */
import { sql } from "../src/db/client";
import { classifyUrl } from "../src/detective/select";
import { evidenceTier, ownHosts } from "../src/detective/anchor";
import { nameTokens, type SupplierProfile } from "../src/detective/queries";

const rows = await sql<{ id: string; tier: number; source_url: string; source_type: string; website: string | null; name_en: string | null; name_ar: string | null; found_website: string | null }[]>`
  select e.id, e.tier, e.source_url, e.source_type, s.website, s.name_en, s.name_ar,
         (select x.output->'tool_calls'->0->'args'->>'website' from run_steps x where x.run_id = e.run_id and x.name = 'extract' order by x.seq desc limit 1) as found_website
  from evidence e join capabilities c on c.id = e.capability_id join suppliers s on s.id = c.supplier_id
  where e.run_id is not null`;
let changed = 0; const tally: Record<string, number> = {};
for (const r of rows) {
  const own = ownHosts(r.website, r.found_website);
  const page = classifyUrl(r.source_url, nameTokens({ id: "", name_ar: r.name_ar, name_en: r.name_en, city_en: null, region_en: null, website: r.website, cr_number: null, declared: [] } as SupplierProfile));
  const tier = evidenceTier(r.source_url, r.source_type, own, page.kind === "own_site" ? 3 : page.tier);
  if (tier !== r.tier) { changed++; const k = `${r.tier} → ${tier}`; tally[k] = (tally[k] ?? 0) + 1; await sql`update evidence set tier = ${tier} where id = ${r.id}`; }
}
console.log(`retier: ${rows.length} detective evidence records, ${changed} changed`, tally);
await sql.end();
