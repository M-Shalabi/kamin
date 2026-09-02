import { z } from "zod";

const LENS = ["supported", "refuted", "unknown"] as const;
const CLASSES = ["manufacturer", "assembler", "authorised_distributor", "trader"] as const;

export const AuditVerdict = z.object({
  analysis: z.string().describe("Your working notes, up to five sentences, written before you decide the lenses"),
  real: z.object({ verdict: z.enum(LENS).describe("Is this capability real: does the company exist, is it active, does the evidence actually show this product?"), reasoning: z.string(), killer_evidence: z.string().nullable().describe("The single fact that refutes it, if refuted") }),
  at_spec: z.object({ verdict: z.enum(LENS).describe("Does the evidence support the product at the stated specification, or only a category?"), reasoning: z.string() }),
  local: z.object({ class: z.enum(CLASSES).describe("manufacturer makes it in the Kingdom; assembler assembles imported parts; authorised_distributor is a named dealer of a foreign brand; trader imports and resells"), reasoning: z.string() }),
  confidence: z.number().min(0).max(1),
});
export type AuditVerdictT = z.infer<typeof AuditVerdict>;

/** A lens the model wrote as prose instead of an object: recover the verdict and keep the prose as reasoning. */
function lensFromText(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object") return v as Record<string, unknown>;
  const text = String(v ?? "");
  const quoted = text.match(/"verdict"\s*:\s*"([a-z]+)"/i)?.[1];
  const decided = text.match(/\b(?:verdict|conclusion|final(?:ly)?|so|therefore)\b[^.]{0,60}\b(supported|refuted|unknown)\b/i)?.[1];
  const any = text.match(/\b(supported|refuted|unknown)\b/i)?.[1];
  return { verdict: quoted ?? decided ?? any ?? "unknown", reasoning: text.slice(0, 400), class: text.match(/\b(manufacturer|assembler|authori[sz]ed[_ ]distributor|trader)\b/i)?.[1] };
}

const record = (raw: unknown): Record<string, unknown> => (raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {});
const lens = (v: unknown): (typeof LENS)[number] => { const s = String(v ?? "").toLowerCase(); return s.startsWith("support") || s === "yes" || s === "true" ? "supported" : s.startsWith("refut") || s === "no" || s === "false" ? "refuted" : "unknown"; };
const cls = (v: unknown): (typeof CLASSES)[number] => { const s = String(v ?? "").toLowerCase().replace(/[\s-]+/g, "_"); return (CLASSES as readonly string[]).includes(s) ? s as (typeof CLASSES)[number] : s.includes("distrib") || s.includes("dealer") || s.includes("agent") ? "authorised_distributor" : s.includes("assembl") ? "assembler" : s.includes("trad") || s.includes("import") || s.includes("resell") || s.includes("stockist") ? "trader" : "manufacturer"; };
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

export const AuditVerdictLoose: z.ZodType<AuditVerdictT> = z.preprocess((raw) => {
  const r = record(raw);
  const real = lensFromText(r.real), spec = lensFromText(r.at_spec), local = lensFromText(r.local);
  const c = typeof r.confidence === "number" ? r.confidence : Number(r.confidence);
  return {
    analysis: str(r.analysis),
    real: { verdict: lens(real.verdict), reasoning: str(real.reasoning), killer_evidence: real.killer_evidence === null || real.killer_evidence === undefined || real.killer_evidence === "" ? null : str(real.killer_evidence) },
    at_spec: { verdict: lens(spec.verdict), reasoning: str(spec.reasoning) },
    local: { class: cls(local.class), reasoning: str(local.reasoning) },
    confidence: Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0.5,
  };
}, AuditVerdict);
