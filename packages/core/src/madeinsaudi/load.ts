import type { Sql } from "postgres";
import { nameSimilarity } from "../text/names";

export type Member = { id: number; name: string | null; name_arabic: string | null; brand: string | null; cr_number: string | null; sector: string | null; products: string[]; description: string | null; website: string | null; raw: unknown };

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const productNames = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => { const r = (x ?? {}) as Record<string, unknown>; return str(r.product_name_english ?? r.name_english ?? r.name ?? r.title ?? r.product_name) ?? ""; }).filter(Boolean) : []);

/** Members captured as { id, list, detail, products } where detail is the member's Next.js page data. */
export function extractMembers(captured: unknown[]): Member[] {
  const out: Member[] = [];
  const seen = new Set<number>();
  for (const c of captured) {
    const rec = (c ?? {}) as { id?: unknown; list?: Record<string, unknown>; detail?: Record<string, unknown> | null; products?: unknown[] };
    const id = Number(rec.id);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    const list = rec.list ?? {};
    const detail = rec.detail ?? {};
    const reg = ((detail.form_company_registration ?? list.form_company_registration ?? {}) as Record<string, unknown>);
    out.push({
      id,
      name: str(list.company_registered_name ?? reg.company_registered_name ?? list.brand_name_english),
      name_arabic: str(list.company_registered_name_arabic ?? reg.company_registered_name_arabic ?? list.brand_name_arabic),
      brand: str(list.brand_name_english ?? reg.brand_name_english),
      cr_number: str(reg.commercial_registration_number)?.replace(/\D/g, "") || null,
      sector: str(reg.sector ?? list.sector),
      products: productNames(rec.products),
      description: str(detail.company_short_description_english),
      website: str(reg.website ?? detail.website ?? list.website),
      raw: c,
    });
  }
  return out;
}

export async function loadMembers(db: Sql, members: Member[], opts: { threshold?: number; onlyIds?: string[] } = {}): Promise<{ members: number; matched_cr: number; matched_name: number; created: number; evidence: number }> {
  const threshold = opts.threshold ?? 0.6;
  const suppliers = opts.onlyIds
    ? await db<{ id: string; name_ar: string | null; name_en: string | null; cr_number: string | null }[]>`select id, name_ar, name_en, cr_number from suppliers where id = any(${opts.onlyIds})`
    : await db<{ id: string; name_ar: string | null; name_en: string | null; cr_number: string | null }[]>`select id, name_ar, name_en, cr_number from suppliers where source <> 'made_in_saudi'`;
  const byCr = new Map(suppliers.filter((s) => s.cr_number).map((s) => [s.cr_number!, s.id]));
  let matchedCr = 0, matchedName = 0, created = 0, evidence = 0;
  for (const m of members) {
    let target: string | null = m.cr_number ? byCr.get(m.cr_number) ?? null : null;
    if (target) matchedCr++;
    else {
      let best: { id: string; score: number } | null = null;
      for (const s of suppliers) {
        const score = Math.max(m.name_arabic && s.name_ar ? nameSimilarity(m.name_arabic, s.name_ar) : 0, m.name && s.name_en ? nameSimilarity(m.name, s.name_en) : 0, m.name && s.name_ar ? nameSimilarity(m.name, s.name_ar) : 0);
        if (score >= threshold && (!best || score > best.score)) best = { id: s.id, score };
      }
      if (best) { target = best.id; matchedName++; }
    }
    const excerpt = `Made in Saudi certified member${m.sector ? ` (${m.sector})` : ""}${m.products.length ? `: ${m.products.slice(0, 8).join(", ")}` : ""}`.slice(0, 300);
    const url = `https://saudimade.sa/en/members/${m.id}`;
    if (!target) {
      if (opts.onlyIds) continue;
      const id = `made_in_saudi:${m.id}`;
      const [row] = await db<{ inserted: boolean }[]>`
        insert into suppliers (id, name_ar, name_en, cr_number, website, source, in_made_in_saudi, summary, raw)
        values (${id}, ${m.name_arabic}, ${m.name ?? m.brand}, ${m.cr_number}, ${m.website}, 'made_in_saudi', true, ${m.description}, ${db.json({ made_in_saudi: { id: m.id, sector: m.sector, products: m.products } } as never)})
        on conflict (id) do update set name_ar = excluded.name_ar, name_en = excluded.name_en, cr_number = excluded.cr_number, raw = excluded.raw, updated_at = now()
        returning (xmax = 0) as inserted`;
      if (row?.inserted) created++;
      continue;
    }
    const chosen = target;
    await db.begin(async (tx) => {
      await tx`update suppliers set in_made_in_saudi = true, website = coalesce(website, ${m.website}), raw = coalesce(raw, '{}'::jsonb) || ${tx.json({ made_in_saudi: { id: m.id, sector: m.sector, products: m.products, matched_by: m.cr_number && byCr.get(m.cr_number) === chosen ? "cr" : "name" } } as never)}, updated_at = now() where id = ${chosen}`;
      const caps = await tx<{ id: string }[]>`select id from capabilities where supplier_id = ${chosen}`;
      for (const c of caps) {
        await tx`delete from evidence where capability_id = ${c.id} and source_type = 'certification' and source_url like 'https://saudimade.sa/%'`;
        await tx`insert into evidence (capability_id, tier, source_type, source_url, excerpt, title) values (${c.id}, 1, 'certification', ${url}, ${excerpt}, 'Made in Saudi certification')`;
        evidence++;
      }
    });
  }
  return { members: members.length, matched_cr: matchedCr, matched_name: matchedName, created, evidence };
}
