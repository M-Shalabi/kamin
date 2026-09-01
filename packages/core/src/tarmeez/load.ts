import type { Sql } from "postgres";
import { tariffToHs6 } from "../hs/codes";
import type { ProductListItem } from "./client";
import { stripCodePrefix, type mapPlant } from "./map";

export async function loadPlant(db: Sql, m: ReturnType<typeof mapPlant>): Promise<void> {
  await db.begin(async (tx) => {
    const s = m.supplier;
    await tx`
      insert into suppliers ${tx({ ...s, raw: tx.json(s.raw as never) })}
      on conflict (id) do update set
        name_ar = excluded.name_ar, name_en = excluded.name_en, cr_number = excluded.cr_number,
        city_ar = excluded.city_ar, city_en = excluded.city_en, region_ar = excluded.region_ar, region_en = excluded.region_en,
        investment_type = excluded.investment_type, website = excluded.website, email = excluded.email, phone = excluded.phone,
        tarmeez_symbol = excluded.tarmeez_symbol, in_tarmeez = true, raw = excluded.raw, updated_at = now()`;
    if (m.products.length) {
      await tx`insert into products ${tx(m.products, "tariff_code", "hs6", "title_ar", "title_en", "tarmeez_id", "source")} on conflict (tariff_code) do nothing`;
    }
    for (const c of m.capabilities) {
      await tx`
        insert into capabilities (supplier_id, tariff_code, hs6, class, verdict, declared_amount, declared_unit, declared_lines)
        values (${c.supplier_id}, ${c.tariff_code}, ${c.hs6}, ${c.class}, ${c.verdict}, ${c.declared_amount}, ${c.declared_unit}, ${tx.json(c.declared_lines as never)})
        on conflict (supplier_id, tariff_code) do update set
          declared_amount = excluded.declared_amount, declared_unit = excluded.declared_unit, declared_lines = excluded.declared_lines, updated_at = now()`;
    }
    for (const e of m.evidence) {
      const [cap] = await tx<{ id: string }[]>`select id from capabilities where supplier_id = ${e.supplier_id} and tariff_code = ${e.tariff_code}`;
      if (!cap) continue;
      await tx`delete from evidence where capability_id = ${cap.id} and source_type = ${e.source_type}`;
      await tx`insert into evidence (capability_id, tier, source_type, source_url, excerpt, raw) values (${cap.id}, ${e.tier}, ${e.source_type}, ${e.source_url}, ${e.excerpt}, ${tx.json(e.raw as never)})`;
    }
  });
}

export async function loadProductList(db: Sql, items: ProductListItem[]): Promise<number> {
  const rows = new Map<string, { tariff_code: string; hs6: string; title_ar: string; title_en: string; tarmeez_id: number; source: "tarmeez" }>();
  for (const it of items) {
    const code = (it.Symbol?.En ?? "").trim();
    if (!/^\d{6,12}$/.test(code) || rows.has(code)) continue;
    rows.set(code, { tariff_code: code, hs6: tariffToHs6(code), title_ar: stripCodePrefix(it.Title.Ar), title_en: stripCodePrefix(it.Title.En), tarmeez_id: it.Id, source: "tarmeez" });
  }
  const list = [...rows.values()];
  for (let i = 0; i < list.length; i += 500) {
    await db`insert into products ${db(list.slice(i, i + 500), "tariff_code", "hs6", "title_ar", "title_en", "tarmeez_id", "source")} on conflict (tariff_code) do nothing`;
  }
  return list.length;
}
