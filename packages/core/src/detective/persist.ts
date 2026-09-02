import type { Sql } from "postgres";
import type { SupplierProfile } from "./queries";
import type { DetectiveFindingsT } from "./schema";
import type { PageCandidate } from "./select";

export async function loadProfile(db: Sql, supplierId: string): Promise<SupplierProfile> {
  const [s] = await db<{ id: string; name_ar: string | null; name_en: string | null; city_en: string | null; region_en: string | null; website: string | null; cr_number: string | null }[]>`
    select id, name_ar, name_en, city_en, region_en, website, cr_number from suppliers where id = ${supplierId}`;
  if (!s) throw new Error(`supplier ${supplierId} not found`);
  const declared = await db<{ hs6: string; title_en: string; title_ar: string; amount: number | null; unit: string | null }[]>`
    select c.hs6, coalesce(p.title_en, c.product_title, '') as title_en, coalesce(p.title_ar, '') as title_ar, c.declared_amount::float as amount, c.declared_unit as unit
    from capabilities c left join products p on p.tariff_code = c.tariff_code
    where c.supplier_id = ${supplierId} and c.origin = 'tarmeez' order by c.hs6`;
  return { ...s, declared };
}

const TIER_BY_KIND: Record<string, 1 | 2 | 3> = { certification: 1, award: 1, registry: 2, directory: 2, catalogue: 3, website: 3, news: 3 };

export async function mergeFindings(db: Sql, profile: SupplierProfile, f: DetectiveFindingsT, runId: string, pages: PageCandidate[]): Promise<{ capabilities: number; evidence: number; created: number }> {
  const pageTier = new Map(pages.map((p) => [p.url, p.tier]));
  const tierFor = (url: string, kind: string): 1 | 2 | 3 => Math.min(pageTier.get(url) ?? 3, TIER_BY_KIND[kind] ?? 3) as 1 | 2 | 3;
  let evidenceCount = 0, created = 0, touched = 0;
  await db.begin(async (tx) => {
    await tx`delete from evidence where run_id = ${runId}`;
    const capIds: string[] = [];
    for (const cap of f.capabilities) {
      const hs6 = cap.hs6_guess;
      let id: string | undefined;
      if (hs6) {
        const [existing] = await tx<{ id: string }[]>`select id from capabilities where supplier_id = ${profile.id} and hs6 = ${hs6} order by (origin = 'tarmeez') desc, created_at limit 1`;
        id = existing?.id;
      }
      const cls = cap.class_guess === "unknown" ? null : cap.class_guess;
      const attrs = Object.fromEntries(cap.spec_attrs.map((a) => [a.key, a.value]));
      if (id) {
        await tx`update capabilities set spec_attrs = coalesce(spec_attrs, '{}'::jsonb) || ${tx.json(attrs as never)}, class = coalesce(${cls}, class), updated_at = now() where id = ${id}`;
      } else {
        const [row] = await tx<{ id: string; inserted: boolean }[]>`
          insert into capabilities (supplier_id, tariff_code, hs6, product_title, spec_attrs, class, origin)
          values (${profile.id}, null, ${hs6 ?? "000000"}, ${cap.product}, ${tx.json(attrs as never)}, ${cls ?? (profile.declared.length ? "manufacturer" : "trader")}, 'detective')
          on conflict (supplier_id, hs6, lower(product_title)) where tariff_code is null do update set updated_at = now()
          returning id, (xmax = 0) as inserted`;
        id = row!.id;
        if (row!.inserted) created++;
      }
      capIds.push(id); touched++;
      for (const e of cap.evidence) {
        await tx`insert into evidence (capability_id, tier, source_type, source_url, excerpt, run_id, title) values (${id}, ${tierFor(e.url, e.kind)}, ${e.kind}, ${e.url}, ${e.excerpt}, ${runId}, ${pages.find((p) => p.url === e.url)?.title ?? null})`;
        evidenceCount++;
      }
    }
    const targets = capIds.length ? capIds : (await tx<{ id: string }[]>`select id from capabilities where supplier_id = ${profile.id}`).map((r) => r.id);
    for (const cert of f.certifications) {
      for (const id of targets) {
        await tx`insert into evidence (capability_id, tier, source_type, source_url, excerpt, run_id, title) values (${id}, 1, 'certification', ${cert.url || (f.website ?? "")}, ${`${cert.name}: ${cert.excerpt}`.slice(0, 300)}, ${runId}, ${cert.name})`;
        evidenceCount++;
      }
    }
    await tx`update suppliers set website = coalesce(website, ${f.website}), summary = coalesce(nullif(${f.summary}, ''), summary), detective_status = 'ok', detective_run_id = ${runId}, detective_at = now(), updated_at = now() where id = ${profile.id}`;
  });
  return { capabilities: touched, evidence: evidenceCount, created };
}
