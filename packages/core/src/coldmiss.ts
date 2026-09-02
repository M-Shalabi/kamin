import type { Sql } from "postgres";
import { runAuditor } from "./auditor/run";
import { runDetective } from "./detective/run";

/** Sector filter shared with the swarm: valves, pumps and pipe fittings. */
const SECTOR = ["8481", "8413", "7307"];

/**
 * The cold miss on stage: a supplier that is on the map with declared capabilities only.
 * Runs the Detective once, then the Auditor on up to three sector capabilities, and
 * streams every trajectory line to the sink so the audience watches the node fill in.
 */
export async function coldMiss(db: Sql, supplierId: string, sink: (line: string) => void): Promise<{
  detective: { runId: string; merged: { capabilities: number; evidence: number; created: number } };
  audits: { capabilityId: string; product: string; verdict: string; class: string; confidence: number }[];
}> {
  sink(`▷ cold miss: ${supplierId} is on the map with declared capabilities only. Investigating.`);
  const detective = await runDetective(db, supplierId, { sink });
  const caps = await db<{ id: string; hs6: string; product: string | null }[]>`
    select c.id, c.hs6, coalesce(c.product_title, p.title_en) as product
    from capabilities c left join products p on p.tariff_code = c.tariff_code
    where c.supplier_id = ${supplierId} and left(c.hs6, 4) in ${db(SECTOR)}
    order by (select count(*) from evidence e where e.capability_id = c.id and e.run_id = ${detective.runId}) desc,
             (select count(*) from evidence e where e.capability_id = c.id) desc, c.verdict = 'pending' desc, c.hs6 limit 3`;
  sink(`▷ auditing ${caps.length} ${caps.length === 1 ? "capability" : "capabilities"} in the valve, pump and fitting slice`);
  const audits: { capabilityId: string; product: string; verdict: string; class: string; confidence: number }[] = [];
  for (const c of caps) {
    const product = c.product ?? `HS ${c.hs6}`;
    const r = await runAuditor(db, c.id, { sink });
    audits.push({ capabilityId: c.id, product, verdict: r.verdict, class: r.class, confidence: r.confidence });
    sink(`▷ ${product}: ${r.verdict}, ${r.class.replace(/_/g, " ")}, confidence ${r.confidence.toFixed(2)}`);
  }
  sink(`▷ done: ${detective.merged.evidence} evidence records and ${audits.length} verdicts written to the map`);
  return { detective: { runId: detective.runId, merged: detective.merged }, audits };
}
