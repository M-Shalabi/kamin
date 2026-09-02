import { z } from "zod";

export const CLASS_GUESSES = ["manufacturer", "assembler", "authorised_distributor", "trader", "unknown"] as const;
export const EVIDENCE_KINDS = ["certification", "award", "registry", "directory", "catalogue", "website", "news"] as const;

export const DetectiveFindings = z.object({
  website: z.string().nullable().describe("The supplier's own website if any page belongs to it"),
  is_same_company: z.boolean().describe("Whether the evidence pages refer to this supplier and not a namesake"),
  capabilities: z.array(z.object({
    product: z.string().describe("Product line in English, for example 'stainless steel ball valves'"),
    hs6_guess: z.string().nullable().describe("Six-digit HS subheading if you can tell"),
    class_guess: z.enum(CLASS_GUESSES).describe("manufacturer, assembler, authorised_distributor, trader, or unknown"),
    spec_attrs: z.array(z.object({ key: z.string(), value: z.string() })).describe("Sizes, materials, ratings, standards actually stated"),
    evidence: z.array(z.object({ url: z.string(), excerpt: z.string().describe("Up to 300 characters quoted from the page"), kind: z.enum(EVIDENCE_KINDS) })),
  })),
  certifications: z.array(z.object({ name: z.string(), url: z.string(), excerpt: z.string() })),
  signals: z.object({ employees: z.string().nullable(), capacity: z.string().nullable(), facility: z.string().nullable() }),
  summary: z.string().describe("Three sentences: what this company is, what it makes or sells, what the evidence shows"),
});
export type DetectiveFindingsT = z.infer<typeof DetectiveFindings>;

/** A value that may have arrived as a JSON string (see reviveJsonStrings in models/structured.ts); parsed when it looks like JSON. */
const jsonish = (v: unknown): unknown => { if (typeof v !== "string" || !/^\s*[\[{]/.test(v)) return v; try { return JSON.parse(v); } catch { return v; } };
const arr = (v: unknown): unknown[] => { const x = jsonish(v); return Array.isArray(x) ? x : []; };
const record = (raw: unknown): Record<string, unknown> => { const x = jsonish(raw); return x && typeof x === "object" && !Array.isArray(x) ? { ...(x as Record<string, unknown>) } : {}; };
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const nullableStr = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));
const bool = (v: unknown): boolean => v === true || String(v).toLowerCase() === "true" || String(v).toLowerCase() === "yes";
const pairs = (raw: unknown): { key: string; value: string }[] => { const v = jsonish(raw); return Array.isArray(v) ? v.filter((x) => x && typeof x === "object" && "key" in (x as object)).map((x) => ({ key: str((x as { key: unknown }).key), value: str((x as { value?: unknown }).value) }))
  : v && typeof v === "object" ? Object.entries(v as Record<string, unknown>).filter(([, val]) => val !== null && val !== undefined && val !== "").map(([k, val]) => ({ key: k, value: str(val) })) : []; };
const website = (v: unknown): string | null => {
  const s = nullableStr(v); if (!s) return null;
  const t = s.trim().replace(/\s.*$/, "");
  if (!/^https?:\/\//i.test(t)) return /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(t) ? `https://${t}` : null;
  return t;
};

export const DetectiveFindingsLoose: z.ZodType<DetectiveFindingsT> = z.preprocess((raw) => {
  const r = record(raw);
  r.website = website(r.website);
  r.is_same_company = bool(r.is_same_company);
  r.capabilities = arr(r.capabilities).map((c) => {
    const x = record(c);
    const code = str(x.hs6_guess).replace(/[^\d]/g, "").slice(0, 6);
    const guess = str(x.class_guess).toLowerCase().replace(/\s+/g, "_");
    return {
      product: str(x.product) || "unspecified product",
      hs6_guess: code.length === 6 ? code : null,
      class_guess: (CLASS_GUESSES as readonly string[]).includes(guess) ? guess : guess.includes("distrib") ? "authorised_distributor" : guess.includes("trad") || guess.includes("resell") || guess.includes("import") ? "trader" : guess.includes("assembl") ? "assembler" : guess.includes("manufact") || guess.includes("factory") ? "manufacturer" : "unknown",
      spec_attrs: pairs(x.spec_attrs),
      evidence: arr(x.evidence).map((e) => { const y = record(e); const kind = str(y.kind).toLowerCase(); return { url: str(y.url), excerpt: str(y.excerpt).slice(0, 300), kind: (EVIDENCE_KINDS as readonly string[]).includes(kind) ? kind : "website" }; }).filter((e) => e.url),
    };
  });
  r.certifications = arr(r.certifications).map((c) => { const y = record(c); return { name: str(y.name), url: str(y.url), excerpt: str(y.excerpt) }; }).filter((c) => c.name);
  const sig = record(r.signals);
  r.signals = { employees: nullableStr(sig.employees), capacity: nullableStr(sig.capacity), facility: nullableStr(sig.facility) };
  r.summary = str(r.summary);
  return r;
}, DetectiveFindings);
