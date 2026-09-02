import { z } from "zod";

export const InvestmentCase = z.object({
  headline: z.string().describe("One line: the opportunity in plain words"),
  why_now: z.string().describe("Two sentences: pooled demand, regulatory pressure, timing"),
  annual_value_usd: z.number().describe("Annual value of the pooled demand in USD"),
  regulatory_pressure: z.string().describe("What the Mandatory List or local-content rules require for this product, or 'none on record'"),
  pivot_candidates: z.array(z.object({ supplier_id: z.string(), supplier_name: z.string(), why: z.string().describe("Why this plant could make it"), what_they_have: z.string().describe("Equipment, process or material capability they already show"), what_is_missing: z.string().describe("What they would need to add") })),
  raw_materials: z.string().describe("Domestic raw material availability for this product, naming mining companies or sources when known, or 'unknown'"),
  recommended_next_step: z.string().describe("One concrete action for PIF's local content team"),
});
export type InvestmentCaseT = z.infer<typeof InvestmentCase>;

const record = (raw: unknown): Record<string, unknown> => (raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {});
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown): number => { const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(n) ? n : 0; };

export const InvestmentCaseLoose: z.ZodType<InvestmentCaseT> = z.preprocess((raw) => {
  const r = record(raw);
  return {
    headline: str(r.headline), why_now: str(r.why_now), annual_value_usd: num(r.annual_value_usd), regulatory_pressure: str(r.regulatory_pressure),
    pivot_candidates: (Array.isArray(r.pivot_candidates) ? r.pivot_candidates : []).map((c) => { const x = record(c); return { supplier_id: str(x.supplier_id), supplier_name: str(x.supplier_name), why: str(x.why), what_they_have: str(x.what_they_have), what_is_missing: str(x.what_is_missing) }; }).filter((c) => c.supplier_id || c.supplier_name),
    raw_materials: str(r.raw_materials), recommended_next_step: str(r.recommended_next_step),
  };
}, InvestmentCase);
