import type { Sql } from "postgres";
import type { Envelope } from "../coordinator/pool";
import { atSpec, atType, isSupported, scoreCapability, specCompatible, splitShares, type CapabilityCandidate } from "./score";

export async function candidatesFor(db: Sql, hs6: string, onlySupplierIds?: string[]): Promise<CapabilityCandidate[]> {
  const heading = hs6.slice(0, 4) + "%";
  const filter = onlySupplierIds ? db`and c.supplier_id = any(${onlySupplierIds})` : db`and c.supplier_id not like 'test:%'`;
  return db<CapabilityCandidate[]>`
    select c.id, c.supplier_id, c.hs6, c.class, c.verdict, c.confidence::float as confidence, e.best_tier, c.spec_attrs, coalesce(c.product_title, p.title_en) as product_title, c.declared_amount::float as declared_amount, c.declared_unit, s.region_en, s.in_made_in_saudi
    from capabilities c join suppliers s on s.id = c.supplier_id
    left join products p on p.tariff_code = c.tariff_code
    left join (select capability_id, min(tier)::int as best_tier from evidence group by capability_id) e on e.capability_id = c.id
    where c.hs6 like ${heading} and c.verdict <> 'refuted' ${filter}`;
}

export async function matchOrder(db: Sql, orderId: string, opts: { onlySupplierIds?: string[] } = {}): Promise<{ matches: number; supported: number; gap_kind: "covered" | "manufacturing_gap" | "supply_gap"; spec_status: "at_spec" | "type" | "category" | "none" }> {
  const [order] = await db<{ id: string; hs6: string; spec_envelope: Envelope; qty_annual: number | null }[]>`select id, hs6, spec_envelope, qty_annual::float as qty_annual from pooled_orders where id = ${orderId}`;
  if (!order) throw new Error(`pooled order ${orderId} not found`);
  const cands = await candidatesFor(db, order.hs6, opts.onlySupplierIds);
  const scoredAll = cands.map((c) => ({ cap: c, ...scoreCapability({ hs6: order.hs6, envelope: order.spec_envelope }, c) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  // The stored match list is the top twenty; the gap kind and spec status are judged over every candidate.
  const scored = scoredAll.slice(0, 20);
  const shares = splitShares(order, scored.map((x) => x.cap));
  // Only a supported capability at the order's own subheading with no stated attribute in conflict closes a gap.
  // Sibling subheadings and conflicting attributes stay in the list as leads, at a discounted score.
  const closes = (x: { cap: CapabilityCandidate }) => isSupported(x.cap) && x.cap.hs6 === order.hs6 && specCompatible(order.spec_envelope, x.cap.spec_attrs ?? {}).ok;
  const supported = scoredAll.filter(closes);
  const makers = supported.filter((x) => x.cap.class === "manufacturer" || x.cap.class === "assembler");
  const gap_kind = makers.length ? "covered" : supported.length ? "manufacturing_gap" : "supply_gap";
  const o = { hs6: order.hs6, envelope: order.spec_envelope };
  const spec_status: "at_spec" | "type" | "category" | "none" = supported.some((x) => atSpec(o, x.cap)) ? "at_spec" : supported.some((x) => atType(o, x.cap)) ? "type" : supported.length ? "category" : "none";
  const [mandatory] = await db<{ n: number }[]>`select count(*)::int as n from mandatory_list where hs4 = ${order.hs6.slice(0, 4)}`;
  await db.begin(async (tx) => {
    await tx`delete from matches where pooled_order_id = ${orderId}`;
    for (let i = 0; i < scored.length; i++) {
      const x = scored[i]!;
      await tx`insert into matches (pooled_order_id, capability_id, score, share, rank, reasons) values (${orderId}, ${x.cap.id}, ${x.score}, ${shares[i] ?? 0}, ${i + 1}, ${tx.json(x.reasons as never)})`;
    }
    await tx`update pooled_orders set gap_kind = ${gap_kind}, spec_status = ${spec_status}, mandatory = ${(mandatory?.n ?? 0) > 0}, updated_at = now() where id = ${orderId}`;
  });
  return { matches: scored.length, supported: supported.length, gap_kind, spec_status };
}

export async function matchAll(db: Sql): Promise<{ orders: number; covered: number; manufacturing_gaps: number; supply_gaps: number }> {
  const orders = await db<{ id: string }[]>`select id from pooled_orders where title not like 'test %'`;
  const tally = { orders: 0, covered: 0, manufacturing_gaps: 0, supply_gaps: 0 };
  for (const o of orders) {
    const r = await matchOrder(db, o.id);
    tally.orders++;
    if (r.gap_kind === "covered") tally.covered++; else if (r.gap_kind === "manufacturing_gap") tally.manufacturing_gaps++; else tally.supply_gaps++;
  }
  return tally;
}
