import { sql } from "./db";

export type GapKind = "covered" | "manufacturing_gap" | "supply_gap";

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

export async function stats() {
  const [r] = await sql<{ suppliers: number; investigated: number; capabilities: number; supported: number; refuted: number; evidence: number; runs: number; discovered: number }[]>`
    select (select count(*) from suppliers where id not like 'test:%')::int as suppliers,
           (select count(*) from suppliers where detective_status = 'ok' and id not like 'test:%')::int as investigated,
           (select count(*) from capabilities c join suppliers s on s.id = c.supplier_id where s.id not like 'test:%')::int as capabilities,
           (select count(*) from capabilities where verdict = 'supported')::int as supported,
           (select count(*) from capabilities where verdict = 'refuted')::int as refuted,
           (select count(*) from evidence)::int as evidence,
           (select count(*) from runs where input_ref not like 'test%')::int as runs,
           (select count(*) from suppliers where source in ('hunt', 'made_in_saudi', 'mlcp') and not in_tarmeez)::int as discovered`;
  return r!;
}

export type LedgerRow = { id: string; title: string; hs6: string; family: string | null; gap_kind: GapKind | null; mandatory: boolean; annual_value_usd: number | null; qty_annual: number | null; qty_unit: string | null; portco_count: number; line_count: number; pivots: number | null; headline: string | null; supported_count: number };

/** Orders and annual value per gap kind, for the ledger tabs and its empty state. */
export async function ledgerCounts(): Promise<Record<string, { n: number; usd: number }>> {
  const rows = await sql<{ gap_kind: string | null; n: number; usd: number }[]>`
    select coalesce(gap_kind, 'unmatched') as gap_kind, count(*)::int as n, coalesce(sum(annual_value_usd), 0)::float as usd
    from pooled_orders where title not like 'test %' group by 1`;
  return Object.fromEntries(rows.map((r) => [r.gap_kind ?? "unmatched", { n: r.n, usd: r.usd }]));
}

export async function ledger(kind: GapKind | "all"): Promise<LedgerRow[]> {
  const filter = kind === "all" ? sql`` : sql`and o.gap_kind = ${kind}`;
  return sql<LedgerRow[]>`
    select o.id, o.title, o.hs6, o.family, o.gap_kind, o.mandatory, o.annual_value_usd::float as annual_value_usd, o.qty_annual::float as qty_annual, o.qty_unit, o.portco_count,
           (select count(*)::int from demand_lines d where d.pooled_order_id = o.id) as line_count,
           jsonb_array_length(g."case"->'pivot_candidates') as pivots, g."case"->>'headline' as headline,
           (select count(*)::int from matches m join capabilities c on c.id = m.capability_id left join (select capability_id, min(tier) as best from evidence group by capability_id) e on e.capability_id = c.id where m.pooled_order_id = o.id and c.verdict = 'supported' and e.best <= 2) as supported_count
    from pooled_orders o left join gap_cases g on g.pooled_order_id = o.id
    where o.title not like 'test %' ${filter}
    order by o.annual_value_usd desc nulls last`;
}

export async function orderDetail(id: string) {
  const [o] = await sql<(LedgerRow & { spec_envelope: Record<string, unknown>; qty_now: number | null; gap_case: Record<string, unknown> | null; import_value_usd: number | null })[]>`
    select o.id, o.title, o.hs6, o.family, o.gap_kind, o.mandatory, o.annual_value_usd::float as annual_value_usd, o.qty_annual::float as qty_annual, o.qty_now::float as qty_now, o.qty_unit, o.portco_count, o.spec_envelope,
           0 as line_count, jsonb_array_length(g."case"->'pivot_candidates') as pivots, g."case"->>'headline' as headline, g."case" as gap_case, 0 as supported_count,
           (select value_usd::float from imports i where i.hs6 = o.hs6 and i.year = 2024) as import_value_usd
    from pooled_orders o left join gap_cases g on g.pooled_order_id = o.id where o.id = ${id}`;
  if (!o) return null;
  const lines = await sql<{ id: string; raw_text: string; portco: string; source_system: string | null; qty: number | null; qty_unit: string | null; history_factor: number; annual_value_usd: number | null; hs6: string | null; confidence: number | null; run_id: string | null }[]>`
    select id, raw_text, portco, source_system, qty::float as qty, qty_unit, history_factor::float as history_factor, annual_value_usd::float as annual_value_usd, hs6, confidence::float as confidence, run_id from demand_lines where pooled_order_id = ${id} order by portco, raw_text`;
  const matches = await sql<{ capability_id: string; supplier_id: string; supplier_name: string; region: string | null; product: string; class: string; verdict: string; confidence: number | null; best_tier: number | null; score: number; share: number | null; rank: number; reasons: Record<string, unknown>; in_made_in_saudi: boolean }[]>`
    select m.capability_id, c.supplier_id, coalesce(s.name_en, s.name_ar, s.id) as supplier_name, s.region_en as region, coalesce(c.product_title, p.title_en, c.hs6) as product, c.class, c.verdict, c.confidence::float as confidence, e.best_tier, m.score::float as score, m.share::float as share, m.rank, m.reasons, s.in_made_in_saudi
    from matches m join capabilities c on c.id = m.capability_id join suppliers s on s.id = c.supplier_id left join products p on p.tariff_code = c.tariff_code
    left join (select capability_id, min(tier)::int as best_tier from evidence group by capability_id) e on e.capability_id = c.id
    where m.pooled_order_id = ${id} order by m.rank`;
  return { ...o, lines, matches };
}

export type SupplierRow = { id: string; name_ar: string | null; name_en: string | null; city_en: string | null; region_en: string | null; source: string; in_tarmeez: boolean; in_mlcp: boolean; in_made_in_saudi: boolean; detective_status: string; capability_count: number; supported_count: number; best_class: string | null };

export async function supplierList(f: { family?: string; region?: string; cls?: string; verdict?: string; registry?: string; q?: string } = {}): Promise<SupplierRow[]> {
  const famLike = f.family === "valve" ? "8481%" : f.family === "pump" ? "8413%" : f.family === "fitting" ? "7307%" : f.family === "flange" ? "7307%" : "%";
  const registry = f.registry === "tarmeez" ? sql`and s.in_tarmeez` : f.registry === "mlcp" ? sql`and s.in_mlcp` : f.registry === "made_in_saudi" ? sql`and s.in_made_in_saudi` : f.registry === "discovered" ? sql`and not s.in_tarmeez` : sql``;
  const region = f.region ? sql`and s.region_en = ${f.region}` : sql``;
  const cls = f.cls ? sql`and c.class = ${f.cls}` : sql``;
  const verdict = f.verdict ? sql`and c.verdict = ${f.verdict}` : sql``;
  const q = f.q ? sql`and (s.name_ar ilike ${"%" + f.q + "%"} or s.name_en ilike ${"%" + f.q + "%"} or s.cr_number = ${f.q})` : sql``;
  return sql<SupplierRow[]>`
    select s.id, s.name_ar, s.name_en, s.city_en, s.region_en, s.source, s.in_tarmeez, s.in_mlcp, s.in_made_in_saudi, s.detective_status,
           count(c.id)::int as capability_count, count(c.id) filter (where c.verdict = 'supported')::int as supported_count,
           (array_agg(c.class order by case c.class when 'manufacturer' then 0 when 'assembler' then 1 when 'authorised_distributor' then 2 else 3 end))[1] as best_class
    from suppliers s join capabilities c on c.supplier_id = s.id
    where s.id not like 'test:%' and c.hs6 like ${famLike} ${registry} ${region} ${cls} ${verdict} ${q}
    group by s.id order by supported_count desc, (s.detective_status = 'ok') desc, capability_count desc, s.id limit 300`;
}

export async function supplierDetail(id: string) {
  const [s] = await sql<{ id: string; name_ar: string | null; name_en: string | null; cr_number: string | null; city_en: string | null; region_en: string | null; website: string | null; source: string; in_tarmeez: boolean; in_mlcp: boolean; in_made_in_saudi: boolean; detective_status: string; summary: string | null; investment_type: string | null }[]>`
    select id, name_ar, name_en, cr_number, city_en, region_en, website, source, in_tarmeez, in_mlcp, in_made_in_saudi, detective_status, summary, investment_type from suppliers where id = ${id}`;
  if (!s) return null;
  const capabilities = await sql<{ id: string; hs6: string; product: string; product_ar: string | null; class: string; verdict: string; confidence: number | null; origin: string; declared_amount: number | null; declared_unit: string | null; evidence_count: number; best_tier: number | null; audited_at: string | null }[]>`
    select c.id, c.hs6, coalesce(c.product_title, p.title_en, c.hs6) as product, p.title_ar as product_ar, c.class, c.verdict, c.confidence::float as confidence, c.origin, c.declared_amount::float as declared_amount, c.declared_unit,
           (select count(*)::int from evidence e where e.capability_id = c.id) as evidence_count, (select min(tier)::int from evidence e where e.capability_id = c.id) as best_tier, c.audited_at::text as audited_at
    from capabilities c left join products p on p.tariff_code = c.tariff_code where c.supplier_id = ${id}
    order by (c.verdict = 'supported') desc, best_tier nulls last, c.hs6`;
  const runs = await sql<{ id: string; role: string; status: string; model: string; started_at: string; seconds: number | null }[]>`
    select r.id, r.role, r.status, r.model, r.started_at::text as started_at, extract(epoch from (r.finished_at - r.started_at))::float as seconds
    from runs r where r.input_ref = ${id} or r.input_ref in (select id::text from capabilities where supplier_id = ${id}) order by r.started_at desc limit 50`;
  return { ...s, capabilities, runs };
}

export async function capabilityDetail(id: string) {
  const [c] = await sql<{ id: string; supplier_id: string; supplier_name: string; supplier_name_ar: string | null; hs6: string; product: string; class: string; verdict: string; confidence: number | null; class_confidence: number | null; lenses: Record<string, unknown> | null; spec_attrs: Record<string, string>; origin: string; declared_amount: number | null; declared_unit: string | null; audit_run_id: string | null; in_made_in_saudi: boolean; in_tarmeez: boolean; in_mlcp: boolean; cr_number: string | null; mandatory: boolean }[]>`
    select c.id, c.supplier_id, coalesce(s.name_en, s.name_ar, s.id) as supplier_name, s.name_ar as supplier_name_ar, c.hs6, coalesce(c.product_title, p.title_en, c.hs6) as product, c.class, c.verdict, c.confidence::float as confidence, c.class_confidence::float as class_confidence, c.lenses, c.spec_attrs, c.origin, c.declared_amount::float as declared_amount, c.declared_unit, c.audit_run_id, s.in_made_in_saudi, s.in_tarmeez, s.in_mlcp, s.cr_number,
           exists (select 1 from mandatory_list m where m.hs4 = left(c.hs6, 4)) as mandatory
    from capabilities c join suppliers s on s.id = c.supplier_id left join products p on p.tariff_code = c.tariff_code where c.id = ${id}`;
  if (!c) return null;
  const evidence = await sql<{ id: string; tier: number; source_type: string; source_url: string; excerpt: string | null; title: string | null; run_id: string | null; fetched_at: string }[]>`
    select id, tier, source_type, source_url, excerpt, title, run_id, fetched_at::text as fetched_at from evidence where capability_id = ${id} order by tier, fetched_at`;
  const runs = await sql<{ id: string; role: string; status: string; model: string; started_at: string; seconds: number | null }[]>`
    select r.id, r.role, r.status, r.model, r.started_at::text as started_at, extract(epoch from (r.finished_at - r.started_at))::float as seconds
    from runs r where r.id = ${c.audit_run_id} or r.id in (select run_id from evidence where capability_id = ${id} and run_id is not null) or r.input_ref = ${c.supplier_id} order by r.started_at`;
  return { ...c, evidence, runs };
}

export async function runDetail(id: string) {
  const [r] = await sql<{ id: string; role: string; input_ref: string; model: string; status: string; error: string | null; started_at: string; finished_at: string | null }[]>`select id, role, input_ref, model, status, error, started_at::text as started_at, finished_at::text as finished_at from runs where id = ${id}`;
  if (!r) return null;
  const steps = await sql<{ seq: number; kind: string; name: string; input: unknown; output: unknown; duration_ms: number | null; tokens_in: number | null; tokens_out: number | null }[]>`select seq, kind, name, input, output, duration_ms, tokens_in, tokens_out from run_steps where run_id = ${id} order by seq`;
  return { ...r, steps };
}

export async function unenrichedSectorSuppliers(limit = 20) {
  return sql<{ id: string; name_ar: string | null; name_en: string | null; city_en: string | null; detective_status: string; n: number }[]>`
    select s.id, s.name_ar, s.name_en, s.city_en, s.detective_status, count(*)::int as n
    from suppliers s join capabilities c on c.supplier_id = s.id
    where s.in_tarmeez and s.detective_status = 'pending' and (c.hs6 like '8481%' or c.hs6 like '8413%' or c.hs6 like '7307%')
    group by s.id order by n desc, s.id limit ${limit}`;
}
