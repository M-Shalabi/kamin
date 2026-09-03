import { CONNECTIONS, MATERIALS, type NormalizedSpecT } from "./schema";

export type Material = (typeof MATERIALS)[number];
export type Connection = (typeof CONNECTIONS)[number];

export const DN_BY_INCH: Record<string, number> = { "0.375": 10, "0.5": 15, "0.75": 20, "1": 25, "1.25": 32, "1.5": 40, "2": 50, "2.5": 65, "3": 80, "4": 100, "5": 125, "6": 150, "8": 200, "10": 250, "12": 300, "14": 350, "16": 400, "18": 450, "20": 500, "24": 600 };

export const inchToDn = (inch: number): number | null => DN_BY_INCH[String(inch)] ?? null;
export const dnToInch = (dn: number): number | null => {
  const hit = Object.entries(DN_BY_INCH).find(([, v]) => v === dn);
  return hit ? Number(hit[0]) : null;
};

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const latinDigits = (s: string): string => s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));

const fraction = (s: string): number => {
  const m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  const mixed = s.match(/^(\d+)[\s-](\d+)\s*\/\s*(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  return Number(s.replace(",", "."));
};

export function parseSizeToken(token: string): { inch: number | null; dn: number | null } | null {
  const t = latinDigits(token).trim();
  const dn = t.match(/^DN\s*(\d+)$/i);
  if (dn) { const d = Number(dn[1]); return { inch: dnToInch(d), dn: d }; }
  const inch = t.match(/^([\d]+(?:[\s-]\d+)?(?:\s*\/\s*\d+)?(?:[.,]\d+)?)\s*(?:"|''|in\b|inch(?:es)?\b|بوصة|انش|إنش)/i);
  if (inch) { const i = fraction(inch[1]!); return { inch: i, dn: inchToDn(i) }; }
  return null;
}

export function parsePressureToken(token: string): { bar: number | null; klass: string | null } | null {
  const t = latinDigits(token).trim();
  const klass = t.match(/^(?:CL|CLASS)\s*(\d{3,4})$/i) ?? t.match(/^(\d{3,4})\s*#$/);
  if (klass) return { bar: null, klass: klass[1]! };
  const pn = t.match(/^PN\s*(\d+(?:[.,]\d+)?)$/i);
  if (pn) return { bar: Number(pn[1]!.replace(",", ".")), klass: null };
  const bar = t.match(/^(\d+(?:[.,]\d+)?)\s*(?:bar|بار)$/i);
  if (bar) return { bar: Number(bar[1]!.replace(",", ".")), klass: null };
  const psi = t.match(/^(\d+(?:[.,]\d+)?)\s*psi$/i);
  if (psi) return { bar: Number(psi[1]!.replace(",", ".")) / 14.5038, klass: null };
  const kg = t.match(/^(\d+(?:[.,]\d+)?)\s*kg\s*\/?\s*cm2?$/i);
  if (kg) return { bar: Number(kg[1]!.replace(",", ".")) * 0.980665, klass: null };
  return null;
}

const MATERIAL_TOKENS: [RegExp, Material][] = [
  [/stainless|\bss\s*\d{3}|\bss\b|ستانلس|فولاذ مقاوم للصدأ|الفولاذ المقاوم للصدأ|صلب لا يصدأ/i, "stainless_steel"],
  [/ductile|\bdi\b|حديد زهر مطاوع|حديد مطاوع/i, "ductile_iron"],
  [/cast iron|\bci\b|حديد زهر|حديد الزهر/i, "cast_iron"],
  [/carbon steel|\bcs\b|كربون ستيل|فولاذ كربوني|a105|wcb/i, "carbon_steel"],
  [/brass|نحاس أصفر|نحاس/i, "brass"],
  [/bronze|برونز/i, "bronze"],
  [/copper|نحاس أحمر/i, "copper"],
  [/alumin/i, "aluminium"],
  [/pvdf/i, "pvdf"],
  [/u?pvc|بي في سي/i, "pvc"],
  [/hdpe|polyethylene|بولي إيثيلين/i, "hdpe"],
  [/\bpp\b|polypropylene/i, "pp"],
];
export function canonMaterial(token: string): Material | null {
  for (const [re, m] of MATERIAL_TOKENS) if (re.test(token)) return m;
  return null;
}

const CONNECTION_TOKENS: [RegExp, Connection][] = [
  [/flang|flgd|بشفة|فلنج|شفة/i, "flanged"],
  [/thread|npt|bsp|ملولب|مسنن/i, "threaded"],
  [/butt\s*weld|\bbw\b|weld\s*neck|\bwn\b|لحام تناكبي|لحام تناكب/i, "butt_weld"],
  [/socket\s*weld|\bsw\b|لحام مقبس/i, "socket_weld"],
  [/wafer|ويفر/i, "wafer"],
  [/\blug\b/i, "lug"],
  [/groov/i, "grooved"],
  [/push\s*fit/i, "push_fit"],
];
export function canonConnection(token: string): Connection | null {
  for (const [re, c] of CONNECTION_TOKENS) if (re.test(token)) return c;
  return null;
}

export function canonGrade(grade: string | null): string | null {
  if (!grade) return null;
  const g = grade.toUpperCase().replace(/\s+/g, "").replace(/^SS/, "").replace(/^AISI/, "");
  const m = g.match(/^(304|316|321|347|904)(L|H|TI)?$/);
  if (m) return m[1]! + (m[2] ?? "");
  return g.length ? g : null;
}

export function canonicalize(spec: NormalizedSpecT): NormalizedSpecT {
  const out: NormalizedSpecT = { ...spec, extra_attrs: [...spec.extra_attrs] };
  if (out.size_inch !== null && out.size_dn === null) out.size_dn = inchToDn(out.size_inch);
  if (out.size_dn !== null && out.size_inch === null) out.size_inch = dnToInch(out.size_dn);
  for (const { value } of out.extra_attrs) {
    const p = parsePressureToken(value);
    if (p?.bar !== null && p?.bar !== undefined && out.pressure_bar === null) out.pressure_bar = p.bar;
    if (p?.klass && out.pressure_class === null) out.pressure_class = p.klass;
    const s = parseSizeToken(value);
    if (s && out.size_inch === null) { out.size_inch = s.inch; out.size_dn = s.dn; }
  }
  if (out.pressure_class) out.pressure_class = out.pressure_class.replace(/[^\d]/g, "");
  out.material_grade = canonGrade(out.material_grade);
  return out;
}
