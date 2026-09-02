import { sql } from "./db";

export async function coverageSummary() {
  const [r] = await sql<{ spend_total: number; spend_covered: number; line_total: number; line_covered: number; manufacturing_gaps: number; supply_gaps: number; covered: number }[]>`
    select coalesce(sum(annual_value_usd), 0)::float as spend_total,
           coalesce(sum(annual_value_usd) filter (where gap_kind in ('covered', 'manufacturing_gap')), 0)::float as spend_covered,
           count(*)::int as line_total,
           count(*) filter (where gap_kind in ('covered', 'manufacturing_gap'))::int as line_covered,
           count(*) filter (where gap_kind = 'manufacturing_gap')::int as manufacturing_gaps,
           count(*) filter (where gap_kind = 'supply_gap')::int as supply_gaps,
           count(*) filter (where gap_kind = 'covered')::int as covered
    from pooled_orders where title not like 'test %'`;
  const row = r!;
  return { ...row, coverage: row.spend_total ? row.spend_covered / row.spend_total : 0, line_coverage: row.line_total ? row.line_covered / row.line_total : 0 };
}
