export type SupplierProfile = {
  id: string; name_ar: string | null; name_en: string | null; city_en: string | null; region_en: string | null;
  website: string | null; cr_number: string | null;
  declared: { hs6: string; title_en: string; title_ar: string; amount: number | null; unit: string | null }[];
};

const AR_STOP = new Set(["شركة", "مصنع", "مؤسسة", "للصناعة", "للصناعات", "الصناعية", "المحدودة", "للتجارة", "التجارية", "شخص", "واحد", "و", "ال", "بن", "ابن", "فرع", "مجموعة", "ذات", "مسؤولية", "محدودة"]);
const EN_STOP = new Set(["factory", "company", "co", "ltd", "llc", "est", "establishment", "for", "and", "of", "the", "sharikat", "masna", "masnae", "lil", "shakhs", "wahid", "trading", "industrial", "industries", "industry", "group", "branch", "bin", "ibn"]);
const CITY_AR: Record<string, string> = { AlJubail: "الجبيل", Jubail: "الجبيل", Dammam: "الدمام", Riyadh: "الرياض", Jeddah: "جدة", Makkah: "مكة", Madinah: "المدينة", Khobar: "الخبر", Yanbu: "ينبع", Qassim: "القصيم", Buraidah: "بريدة", Tabuk: "تبوك", Hail: "حائل", Abha: "أبها", Taif: "الطائف", Jazan: "جازان", Najran: "نجران" };

export function nameTokens(s: SupplierProfile): string[] {
  const ar = (s.name_ar ?? "").split(/[\s،,()\-]+/).filter((t) => t.length > 2 && !AR_STOP.has(t));
  const en = (s.name_en ?? "").toLowerCase().split(/[\s,()\-.]+/).filter((t) => t.length > 2 && !EN_STOP.has(t));
  const brand = en.filter((t) => !/^lil|^wal|^al[a-z]{2,}/.test(t));
  return [...new Set([...brand, ...en, ...ar])];
}

function productWord(s: SupplierProfile): string {
  const first = s.declared[0]?.title_en ?? "";
  const w = first.toLowerCase().match(/valve|pump|fitting|flange|pipe|tube|cable|wire|steel|plastic|chemical|food|paper|glass|aluminium|copper|cement|concrete|furniture|packag/);
  return w ? (w[0] === "valve" ? "valves" : w[0] === "pump" ? "pumps" : w[0] === "fitting" ? "pipe fittings" : w[0]) : "products";
}

export function buildQueries(s: SupplierProfile): string[] {
  const city = s.city_en ? (CITY_AR[s.city_en.replace(/\s+/g, "")] ?? s.city_en) : "";
  const arName = (s.name_ar ?? "").replace(/شخص واحد|ذات مسؤولية محدودة/g, "").trim();
  const enBrand = nameTokens(s).filter((t) => /^[a-z]+$/.test(t)).slice(0, 3).join(" ");
  const q1 = `${arName} ${city}`.trim();
  const q2 = `${enBrand || s.name_en || ""} ${productWord(s)} ${s.city_en ?? ""} Saudi Arabia`.replace(/\s+/g, " ").trim();
  return [q1, q2];
}
