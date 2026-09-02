import type { Envelope } from "../coordinator/pool";
import { canonMaterial, parseSizeToken } from "../coordinator/units";

export type CapabilityCandidate = { id: string; supplier_id: string; hs6: string; class: string; verdict: string; confidence: number | null; best_tier: number | null; spec_attrs: Record<string, string>; declared_amount: number | null; declared_unit: string | null; region_en: string | null; in_made_in_saudi: boolean };

const CLASS_W: Record<string, number> = { manufacturer: 1, assembler: 0.9, authorised_distributor: 0.6, trader: 0.4 };
const VERDICT_W: Record<string, number> = { supported: 1, pending: 0.5, refuted: 0 };
const TIER_W: Record<number, number> = { 1: 1, 2: 0.85, 3: 0.6, 4: 0.4 };

export function specCompatible(env: Envelope, attrs: Record<string, string>): { ok: boolean; hits: string[]; conflicts: string[] } {
  const hits: string[] = [], conflicts: string[] = [];
  const text = Object.entries(attrs).map(([k, v]) => `${k} ${v}`).join(" ");
  if (env.material) {
    const stated = Object.entries(attrs).filter(([k]) => /material|body|grade/i.test(k)).map(([, v]) => canonMaterial(v)).filter(Boolean);
    if (stated.length) (stated.includes(env.material as never) ? hits : conflicts).push("material");
  }
  if (env.size_inch !== null) {
    const range = text.match(/(\d+(?:\/\d+)?)\s*(?:to|-|–)\s*(\d+(?:\/\d+)?)\s*(?:inch|in|")/i);
    if (range) {
      const lo = parseSizeToken(`${range[1]}"`)?.inch ?? null, hi = parseSizeToken(`${range[2]}"`)?.inch ?? null;
      if (lo !== null && hi !== null) (env.size_inch >= lo && env.size_inch <= hi ? hits : conflicts).push("size");
    }
  }
  return { ok: conflicts.length === 0, hits, conflicts };
}

export function isSupported(cap: CapabilityCandidate): boolean {
  return cap.verdict === "supported" && cap.best_tier !== null && cap.best_tier <= 2;
}

export function scoreCapability(order: { hs6: string; envelope: Envelope }, cap: CapabilityCandidate): { score: number; reasons: Record<string, number | string> } {
  const cls = CLASS_W[cap.class] ?? 0.4;
  const verdict = VERDICT_W[cap.verdict] ?? 0.5;
  const tier = cap.best_tier ? TIER_W[cap.best_tier] ?? 0.4 : 0.4;
  const spec = specCompatible(order.envelope, cap.spec_attrs ?? {});
  const specW = spec.ok ? 1 + 0.1 * spec.hits.length : 0.3;
  const hs = cap.hs6 === order.hs6 ? 1 : cap.hs6.slice(0, 4) === order.hs6.slice(0, 4) ? 0.7 : 0.2;
  const conf = cap.confidence ?? 0.5;
  const mis = cap.in_made_in_saudi ? 1.05 : 1;
  const score = Number((cls * verdict * tier * specW * hs * (0.5 + 0.5 * conf) * mis).toFixed(4));
  return { score, reasons: { class: cap.class, verdict: cap.verdict, tier: cap.best_tier ?? "none", spec: spec.ok ? `ok (${spec.hits.join(",") || "no stated attributes"})` : `conflict (${spec.conflicts.join(",")})`, hs: hs === 1 ? "exact" : hs === 0.7 ? "heading" : "other" } };
}

export function splitShares(order: { qty_annual: number | null }, ranked: CapabilityCandidate[]): number[] {
  const top = ranked.slice(0, 3);
  const caps = top.map((c) => (c.declared_amount && c.declared_unit && /piece|unit|pcs|عدد|قطعة/i.test(c.declared_unit) ? c.declared_amount : null));
  const shares = ranked.map(() => 0);
  if (top.length && caps.every((c) => c !== null)) {
    const total = caps.reduce((s, c) => s + (c ?? 0), 0);
    top.forEach((_, i) => { shares[i] = Number(((caps[i] ?? 0) / total).toFixed(4)); });
  } else {
    top.forEach((_, i) => { shares[i] = 1 / top.length; });
  }
  return shares;
}
