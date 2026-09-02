/** Recomputes verdict and confidence for every audited capability from its stored lenses, after a change to the combining rule. No model calls. */
import { sql } from "../src/db/client";
import { AuditVerdictLoose } from "../src/auditor/schema";
import { lensesToVerdict } from "../src/auditor/verdict";

const rows = await sql<{ id: string; lenses: unknown; spec_attrs: Record<string, string> | null; tiers: number[] | null; verdict: string }[]>`
  select c.id, c.lenses, c.spec_attrs, c.verdict, (select array_agg(e.tier) from evidence e where e.capability_id = c.id) as tiers
  from capabilities c where c.audit_run_id is not null and c.lenses is not null`;
const tally: Record<string, number> = {}; let changed = 0, stripped = 0;
for (const r of rows) {
  const lenses = AuditVerdictLoose.safeParse(r.lenses);
  if (!lenses.success) continue;
  const { clearAttrs, ...v } = lensesToVerdict(lenses.data, r.tiers ?? [], { attrsClaimed: Object.keys(r.spec_attrs ?? {}).length > 0 });
  const key = `${r.verdict} → ${v.verdict}`; tally[key] = (tally[key] ?? 0) + 1;
  if (v.verdict !== r.verdict) changed++;
  if (clearAttrs && Object.keys(r.spec_attrs ?? {}).length) stripped++;
  await sql`update capabilities set verdict = ${v.verdict}, class = ${v.class}, confidence = ${v.confidence}, spec_attrs = case when ${clearAttrs} then '{}'::jsonb else spec_attrs end, updated_at = now() where id = ${r.id}`;
}
console.log(`reverdict: ${rows.length} audited capabilities, ${changed} verdicts changed, ${stripped} attribute sets stripped`);
for (const [k, n] of Object.entries(tally).sort()) console.log(`  ${k}: ${n}`);
await sql.end();
