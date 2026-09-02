import type { Sql } from "postgres";
import { poolLines } from "../coordinator/pool";
import type { NormalizedSpecT } from "../coordinator/schema";

export function envelopeTitle(env: { object_class: string; size_inch: number | null; material: string | null; material_grade: string | null; pressure_bar: number | null; pressure_class: string | null }): string {
  const parts = [env.material ? env.material.replace(/_/g, " ") + (env.material_grade ? ` ${env.material_grade}` : "") : null, env.object_class, env.size_inch !== null ? `${env.size_inch} inch` : null, env.pressure_bar !== null ? `${env.pressure_bar} bar` : env.pressure_class ? `class ${env.pressure_class}` : null];
  return parts.filter(Boolean).join(" ");
}

export async function poolAndPersist(db: Sql, opts: { lineKeyPrefix?: string } = {}): Promise<{ orders: number; lines: number }> {
  const prefix = opts.lineKeyPrefix ? `${opts.lineKeyPrefix}%` : null;
  const lines = await db<{ id: string; portco: string; hs6: string; normalized_spec: NormalizedSpecT; qty: number | null; qty_unit: string | null; history_factor: number; annual_value_usd: number | null }[]>`
    select id, portco, hs6, normalized_spec, qty::float as qty, qty_unit, history_factor::float as history_factor, annual_value_usd::float as annual_value_usd
    from demand_lines where hs6 is not null and normalized_spec is not null and simulated and line_key is not null and (${prefix}::text is null or line_key like ${prefix})`;
  const pooled = poolLines(lines.map((l) => ({ id: l.id, portco: l.portco, hs6: l.hs6, spec: l.normalized_spec, quantity: l.qty })));
  let orders = 0;
  await db.begin(async (tx) => {
    const ids = lines.map((l) => l.id);
    const old = await tx<{ id: string }[]>`select distinct pooled_order_id as id from demand_lines where id = any(${ids}) and pooled_order_id is not null`;
    await tx`update demand_lines set pooled_order_id = null where id = any(${ids})`;
    if (old.length) await tx`delete from pooled_orders where id = any(${old.map((o) => o.id)}) and id not in (select pooled_order_id from demand_lines where pooled_order_id is not null)`;
    for (const o of pooled) {
      const members = lines.filter((l) => o.lineIds.includes(l.id));
      const qtyAnnual = members.reduce((s, l) => s + (l.qty ?? 0) * (l.history_factor || 1), 0);
      const value = members.reduce((s, l) => s + (l.annual_value_usd ?? 0), 0);
      const [row] = await tx<{ id: string }[]>`
        insert into pooled_orders (hs6, spec_envelope, family, title, qty_now, qty_annual, annual_value_usd, portco_count, qty_unit)
        values (${o.hs6}, ${tx.json(o.envelope as never)}, ${o.envelope.object_family}, ${envelopeTitle(o.envelope)}, ${o.qty_now}, ${qtyAnnual}, ${value}, ${o.portcos.length}, ${members[0]?.qty_unit ?? null})
        returning id`;
      await tx`update demand_lines set pooled_order_id = ${row!.id} where id = any(${o.lineIds})`;
      orders++;
    }
  });
  return { orders, lines: lines.length };
}
