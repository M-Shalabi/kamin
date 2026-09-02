import { z } from "zod";
import { CONNECTIONS, FAMILIES, MATERIALS, type HsChoiceT, type NormalizedSpecT } from "./schema";
import { canonConnection, canonMaterial } from "./units";

const num = z.preprocess((v) => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const m = v.replace(",", ".").match(/-?\d+(?:\.\d+)?(?:\s*\/\s*\d+)?/);
    if (!m) return null;
    if (m[0].includes("/")) { const [a, b] = m[0].split("/").map((x) => Number(x.trim())); return b ? a! / b : null; }
    return Number(m[0]);
  }
  return null;
}, z.number().nullable());

const str = z.preprocess((v) => (v === undefined || v === null || v === "" ? null : typeof v === "string" ? v : String(v)), z.string().nullable());

function inferFamily(objectClass: unknown, given: unknown): (typeof FAMILIES)[number] {
  const g = typeof given === "string" ? given.toLowerCase().trim().replace(/s$/, "") : "";
  if ((FAMILIES as readonly string[]).includes(g)) return g as (typeof FAMILIES)[number];
  const oc = typeof objectClass === "string" ? objectClass.toLowerCase() : "";
  if (/valve|cock|tap\b/.test(oc)) return "valve";
  if (/pump/.test(oc)) return "pump";
  if (/flange/.test(oc)) return "flange";
  if (/elbow|\btee\b|nipple|coupling|reducer|union|fitting|bushing|adapter|olet|cap\b/.test(oc)) return "fitting";
  return "other";
}

const record = (raw: unknown): Record<string, unknown> => (raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {});

export const NormalizedSpecLoose: z.ZodType<NormalizedSpecT> = z.preprocess((raw) => {
  const r = record(raw);
  if (typeof r.object_class !== "string" || !r.object_class.trim()) r.object_class = "unknown";
  r.object_family = inferFamily(r.object_class, r.object_family);
  const ea = r.extra_attrs;
  r.extra_attrs = Array.isArray(ea)
    ? ea.filter((x) => x && typeof x === "object" && "key" in (x as object)).map((x) => ({ key: String((x as { key: unknown }).key), value: String((x as { value?: unknown }).value ?? "") }))
    : ea && typeof ea === "object"
      ? Object.entries(ea as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => ({ key: k, value: String(v) }))
      : [];
  r.material = typeof r.material === "string" ? ((MATERIALS as readonly string[]).includes(r.material) ? r.material : canonMaterial(r.material)) : null;
  r.connection = typeof r.connection === "string" ? ((CONNECTIONS as readonly string[]).includes(r.connection) ? r.connection : canonConnection(r.connection)) : null;
  const lang = typeof r.source_language === "string" ? r.source_language.toLowerCase() : "";
  r.source_language = lang === "ar" || lang === "arabic" ? "ar" : lang === "en" || lang === "english" ? "en" : "mixed";
  if (typeof r.english_description !== "string" || !r.english_description.trim()) r.english_description = r.object_class;
  return r;
}, z.object({
  object_class: z.string(),
  object_family: z.enum(FAMILIES),
  size_inch: num, size_dn: num, pressure_bar: num, pressure_class: str,
  material: z.enum(MATERIALS).nullable(), material_grade: str, connection: z.enum(CONNECTIONS).nullable(), standard: str,
  quantity: num, quantity_unit: str,
  extra_attrs: z.array(z.object({ key: z.string(), value: z.string() })),
  english_description: z.string(),
  source_language: z.enum(["ar", "en", "mixed"]),
}));

export const HsChoiceLoose: z.ZodType<HsChoiceT> = z.preprocess((raw) => {
  const r = record(raw);
  r.hs6 = String(r.hs6 ?? "").replace(/[^\d]/g, "").slice(0, 6);
  const c = typeof r.confidence === "number" ? r.confidence : Number(r.confidence);
  r.confidence = Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0.5;
  r.reasoning = typeof r.reasoning === "string" ? r.reasoning : "";
  return r;
}, z.object({ hs6: z.string().regex(/^\d{6}$/), confidence: z.number().min(0).max(1), reasoning: z.string() }));
