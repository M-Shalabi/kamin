import type { AuditVerdictT } from "./schema";

const TIER_FACTOR: Record<number, number> = { 1: 1, 2: 0.85, 3: 0.6, 4: 0.4 };

export function lensesToVerdict(a: AuditVerdictT, tiers: number[]): { verdict: "supported" | "refuted" | "pending"; class: string; confidence: number } {
  const best = tiers.length ? Math.min(...tiers) : null;
  const factor = best ? TIER_FACTOR[best] ?? 0.4 : 0.4;
  const refuted = a.real.verdict === "refuted" || a.at_spec.verdict === "refuted";
  const supported = a.real.verdict === "supported" && a.at_spec.verdict === "supported";
  const raw = Number((a.confidence * factor).toFixed(2));
  return { verdict: refuted ? "refuted" : supported ? "supported" : "pending", class: a.local.class, confidence: refuted ? Math.min(raw, 0.2) : raw };
}
