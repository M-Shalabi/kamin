import type { Sql } from "postgres";

export async function coverage(db: Sql, opts: { onlyOrderIds?: string[] } = {}) {
  const filter = opts.onlyOrderIds ? db`where id = any(${opts.onlyOrderIds})` : db`where title not like 'test %'`;
  const [r] = await db<{ spend_total: number; spend_covered: number; line_total: number; line_covered: number; manufacturing_gaps: number; supply_gaps: number }[]>`
    select coalesce(sum(annual_value_usd), 0)::float as spend_total,
           coalesce(sum(annual_value_usd) filter (where gap_kind in ('covered', 'manufacturing_gap')), 0)::float as spend_covered,
           count(*)::int as line_total,
           count(*) filter (where gap_kind in ('covered', 'manufacturing_gap'))::int as line_covered,
           count(*) filter (where gap_kind = 'manufacturing_gap')::int as manufacturing_gaps,
           count(*) filter (where gap_kind = 'supply_gap')::int as supply_gaps
    from pooled_orders ${filter}`;
  const row = r!;
  return { ...row, coverage: row.spend_total ? row.spend_covered / row.spend_total : 0, line_coverage: row.line_total ? row.line_covered / row.line_total : 0 };
}
