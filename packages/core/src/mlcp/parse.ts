import { decodeEntities } from "../web/fetch";

const clean = (s: string): string => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/ /g, " ").replace(/\s+/g, " ").trim();

export function parseListPage(html: string): { cr: string; name: string; activity: string | null }[] {
  const out: { cr: string; name: string; activity: string | null }[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/href="\/Home\/FactoryDetails\/(\d{6,12})"/g)) {
    const cr = m[1]!;
    if (seen.has(cr)) continue;
    seen.add(cr);
    const before = decodeEntities(html.slice(Math.max(0, m.index! - 3000), m.index!).replace(/<[^>]+>/g, "|")).replace(/ /g, " ").replace(/\s+/g, " ");
    const nameM = before.match(/المصنع\s*:\s*\|*\s*([^|]+)/);
    const name = nameM ? nameM[1]!.trim() : "";
    const after = nameM ? before.slice(before.indexOf(nameM[0]) + nameM[0].length) : "";
    const activity = after.split("|").map((t) => t.trim()).filter((t) => t && !/التفاصيل/.test(t))[0] ?? null;
    out.push({ cr, name, activity });
  }
  return out;
}

export function lastPageNumber(html: string): number {
  const nums = [...html.matchAll(/pageNumber=(\d+)/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 1;
}

function fieldAfter(html: string, label: string): string | null {
  const i = html.indexOf(label);
  if (i < 0) return null;
  const seg = decodeEntities(html.slice(i + label.length, i + label.length + 800).replace(/<[^>]+>/g, "|")).replace(/ /g, " ");
  const v = seg.split("|").map((t) => t.replace(/^[\s:]+/, "").replace(/\s+/g, " ").trim()).filter((t) => t && t !== ":")[0];
  return v ?? null;
}

export function parseDetailPage(html: string) {
  const heads = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => clean(m[1]!)).filter((t) => t && t !== "بيانات المصنع");
  const products: { name: string; quantity: number | null; unit: string | null }[] = [];
  const seen = new Set<string>();
  const tbody = html.match(/<tbody[\s\S]*?<\/tbody>/);
  for (const row of (tbody?.[0] ?? "").matchAll(/<tr[\s\S]*?<\/tr>/g)) {
    const cells = [...row[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => clean(c[1]!));
    if (cells.length < 4) continue;
    const name = cells[1]!;
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    const qtyText = cells[2]!.replace(/[^\d.]/g, "");
    const qty = Number(qtyText);
    products.push({ name, quantity: qtyText && Number.isFinite(qty) ? qty : null, unit: cells[3] || null });
  }
  return {
    name: heads[0] ?? null,
    activity: fieldAfter(html, "النشاط الرئيسي"),
    address: fieldAfter(html, "العنوان"),
    capacity_total: fieldAfter(html, "إجمالي كمية الطاقة الاستيعابية"),
    products,
  };
}
