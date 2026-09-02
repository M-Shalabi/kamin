import type { AuditVerdictT } from "./schema";

const TIER_FACTOR: Record<number, number> = { 1: 1, 2: 0.85, 3: 0.6, 4: 0.4 };

export type Verdict = { verdict: "supported" | "refuted" | "pending"; class: string; confidence: number; clearAttrs: boolean };

/**
 * Combine the three lenses into one verdict.
 *
 * - real refuted: the capability is dead, whatever the spec lens says; confidence capped at 0.2.
 * - real unknown: pending, another Detective pass is needed.
 * - real supported and at_spec supported: supported.
 * - real supported and at_spec refuted: the product exists but the stated attributes do not hold up,
 *   so it stays supported at category level with the attributes stripped and confidence discounted.
 * - real supported and at_spec unknown: pending when attributes were claimed and the evidence is
 *   silent; not applicable (supported, lightly discounted) when the claim stated no attributes.
 *
 * Confidence is the auditor's own figure scaled by the best evidence tier behind the claim.
 */
export function lensesToVerdict(a: AuditVerdictT, tiers: number[], opts: { attrsClaimed?: boolean } = {}): Verdict {
  const best = tiers.length ? Math.min(...tiers) : null;
  const factor = best ? TIER_FACTOR[best] ?? 0.4 : 0.4;
  const raw = a.confidence * factor;
  const round = (x: number) => Number(x.toFixed(2));
  const cls = a.local.class;
  if (a.real.verdict === "refuted") return { verdict: "refuted", class: cls, confidence: round(Math.min(raw, 0.2)), clearAttrs: false };
  if (a.real.verdict !== "supported") return { verdict: "pending", class: cls, confidence: round(raw), clearAttrs: false };
  if (a.at_spec.verdict === "supported") return { verdict: "supported", class: cls, confidence: round(raw), clearAttrs: false };
  if (a.at_spec.verdict === "refuted") return { verdict: "supported", class: cls, confidence: round(raw * 0.6), clearAttrs: true };
  return opts.attrsClaimed ? { verdict: "pending", class: cls, confidence: round(raw), clearAttrs: false } : { verdict: "supported", class: cls, confidence: round(raw * 0.8), clearAttrs: false };
}
