import type { Sql } from "postgres";

export async function coverage(db: Sql, opts: { onlyOrderIds?: string[] } = {}) {
  const filter = opts.onlyOrderIds ? db`where id = any(${opts.onlyOrderIds})` : db`where title not like 'test %'`;
  const [r] = await db<{ spend_total: number; spend_covered: number; line_total: number; line_covered: number; manufacturing_gaps: number; supply_gaps: number; spend_at_spec: number; line_at_spec: number; spend_at_type: number; line_at_type: number }[]>`
    select coalesce(sum(annual_value_usd), 0)::float as spend_total,
           coalesce(sum(annual_value_usd) filter (where gap_kind in ('covered', 'manufacturing_gap')), 0)::float as spend_covered,
           count(*)::int as line_total,
           count(*) filter (where gap_kind in ('covered', 'manufacturing_gap'))::int as line_covered,
           count(*) filter (where gap_kind = 'manufacturing_gap')::int as manufacturing_gaps,
           count(*) filter (where gap_kind = 'supply_gap')::int as supply_gaps,
           coalesce(sum(annual_value_usd) filter (where spec_status = 'at_spec'), 0)::float as spend_at_spec,
           count(*) filter (where spec_status = 'at_spec')::int as line_at_spec,
           coalesce(sum(annual_value_usd) filter (where spec_status in ('at_spec', 'type')), 0)::float as spend_at_type,
           count(*) filter (where spec_status in ('at_spec', 'type'))::int as line_at_type
    from pooled_orders ${filter}`;
  const row = r!;
  return {
    ...row,
    /** Category level: a supported capability at the subheading with nothing in conflict. */
    coverage: row.spend_total ? row.spend_covered / row.spend_total : 0,
    line_coverage: row.line_total ? row.line_covered / row.line_total : 0,
    /** At the stated specification: the headline figure. */
    coverage_spec: row.spend_total ? row.spend_at_spec / row.spend_total : 0,
    line_coverage_spec: row.line_total ? row.line_at_spec / row.line_total : 0,
    /** Type verified or better: the supplier names the order's product type, nothing in conflict, no rating or size confirmed. */
    coverage_type: row.spend_total ? row.spend_at_type / row.spend_total : 0,
    line_coverage_type: row.line_total ? row.line_at_type / row.line_total : 0,
  };
}
