import { tariffToHs6 } from "../hs/codes";
import type { PlantDetail } from "./client";

export type SupplierRow = {
  id: string; name_ar: string | null; name_en: string | null; cr_number: string | null;
  city_ar: string | null; city_en: string | null; region_ar: string | null; region_en: string | null;
  investment_type: string | null; website: string | null; email: string | null; phone: string | null;
  tarmeez_id: number; tarmeez_symbol: string | null; in_tarmeez: true; source: "tarmeez"; raw: unknown;
};
export type ProductRow = { tariff_code: string; hs6: string; title_ar: string; title_en: string; tarmeez_id: number | null; source: "tarmeez" };
export type DeclaredLine = { amount: number | null; unit: string | null };
export type CapabilityRow = {
  supplier_id: string; tariff_code: string; hs6: string; class: "manufacturer"; verdict: "pending";
  declared_amount: number | null; declared_unit: string | null; declared_lines: DeclaredLine[];
};
export type EvidenceRow = { supplier_id: string; tariff_code: string; tier: 2; source_type: "tarmeez_plant"; source_url: string; excerpt: string; raw: unknown };

const clean = (s: string | null | undefined): string | null => {
  const t = (s ?? "").trim();
  return t.length ? t : null;
};

export function stripCodePrefix(title: string): string {
  return title.replace(/^\s*\d{6,12}\s*-\s*/, "").replace(/^[\s-]+/, "").replace(/^"|"$/g, "").trim();
}

export function mapPlant(d: PlantDetail) {
  const id = `tarmeez:${d.Id}`;
  const supplier: SupplierRow = {
    id,
    name_ar: clean(d.Title?.Ar), name_en: clean(d.Title?.En),
    cr_number: clean(d.CommercialRecordNo),
    city_ar: clean(d.Location?.Ar), city_en: clean(d.Location?.En),
    region_ar: clean(d.Governorate?.Ar), region_en: clean(d.Governorate?.En),
    investment_type: clean(d.InvestmentType?.En),
    website: clean(d.WebSiteUrl), email: clean(d.Email), phone: clean(d.PhoneNo) ?? clean(d.MobileNo),
    tarmeez_id: d.Id, tarmeez_symbol: clean(d.Symbol?.En), in_tarmeez: true, source: "tarmeez", raw: d,
  };

  const products = new Map<string, ProductRow>();
  const caps = new Map<string, CapabilityRow>();
  const evidence: EvidenceRow[] = [];
  for (const p of d.Products ?? []) {
    const code = clean(p.Symbol?.En);
    if (!code || !/^\d{6,12}$/.test(code)) continue;
    const hs6 = tariffToHs6(code);
    if (!products.has(code)) {
      products.set(code, { tariff_code: code, hs6, title_ar: stripCodePrefix(p.Title?.Ar ?? ""), title_en: stripCodePrefix(p.Title?.En ?? ""), tarmeez_id: p.Id || null, source: "tarmeez" });
    }
    const line: DeclaredLine = { amount: p.Amount ?? null, unit: clean(p.Unit?.En) };
    const existing = caps.get(code);
    if (existing) {
      existing.declared_lines.push(line);
    } else {
      caps.set(code, { supplier_id: id, tariff_code: code, hs6, class: "manufacturer", verdict: "pending", declared_amount: line.amount, declared_unit: line.unit, declared_lines: [line] });
    }
  }
  for (const cap of caps.values()) {
    const product = products.get(cap.tariff_code)!;
    const lines = cap.declared_lines.map((l) => `${l.amount ?? "?"} ${l.unit ?? ""}`.trim()).join("; ");
    evidence.push({
      supplier_id: id, tariff_code: cap.tariff_code, tier: 2, source_type: "tarmeez_plant",
      source_url: `https://psnr.mim.gov.sa/CatalogApi/api/v1/factories/plants/${d.Id}`,
      excerpt: `${product.title_en} | ${product.title_ar} | declared: ${lines}`,
      raw: (d.Products ?? []).filter((p) => p.Symbol?.En === cap.tariff_code),
    });
  }
  return { supplier, products: [...products.values()], capabilities: [...caps.values()], evidence };
}
