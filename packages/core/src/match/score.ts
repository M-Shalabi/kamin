import { headTokens, productTokens } from "../detective/anchor";
import type { Envelope } from "../coordinator/pool";
import { canonConnection, canonMaterial, inchToDn, parsePressureToken, parseSizeToken } from "../coordinator/units";

export type CapabilityCandidate = { product_title?: string | null; id: string; supplier_id: string; hs6: string; class: string; verdict: string; confidence: number | null; best_tier: number | null; spec_attrs: Record<string, string>; declared_amount: number | null; declared_unit: string | null; region_en: string | null; in_made_in_saudi: boolean };

const CLASS_W: Record<string, number> = { manufacturer: 1, assembler: 0.9, authorised_distributor: 0.6, trader: 0.4 };
const VERDICT_W: Record<string, number> = { supported: 1, pending: 0.5, refuted: 0 };
const TIER_W: Record<number, number> = { 1: 1, 2: 0.85, 3: 0.6, 4: 0.4 };

/** ANSI/ASME pressure classes to an approximate cold working pressure in bar, for comparing a class rating with a bar requirement. */
const CLASS_BAR: Record<string, number> = { "150": 19.6, "300": 51.1, "400": 68.1, "600": 102.1, "900": 153.2, "1500": 255.3, "2500": 425.5 };
const glyphs = (v: string) => v.replace(/½/g, "1/2").replace(/¼/g, "1/4").replace(/¾/g, "3/4").replace(/[”″"]/g, '"').replace(/[–—]/g, "-");

export function specCompatible(env: Envelope, attrs: Record<string, string>): { ok: boolean; hits: string[]; conflicts: string[] } {
  const hits: string[] = [], conflicts: string[] = [];
  const entries = Object.entries(attrs).map(([k, v]) => [k, glyphs(String(v))] as const);
  const text = entries.map(([k, v]) => `${k} ${v}`).join(" ");
  if (env.material) {
    const stated = entries.filter(([k]) => /material|body|grade/i.test(k)).map(([, v]) => canonMaterial(v)).filter(Boolean);
    if (stated.length) (stated.includes(env.material as never) ? hits : conflicts).push("material");
  }
  if (env.size_inch !== null || env.size_dn !== null) {
    const inchRange = text.match(/(\d+(?:\/\d+)?)\s*(?:"|inch|in\b)?\s*(?:\([^)]*\)\s*)?(?:to|-)\s*(\d+(?:\/\d+)?)\s*(?:"|inch|in\b)/i);
    const dnRange = text.match(/DN\s*(\d+)\s*(?:to|-)\s*(?:DN\s*)?(\d+)/i);
    if (inchRange && env.size_inch !== null) {
      const lo = parseSizeToken(`${inchRange[1]}"`)?.inch ?? null, hi = parseSizeToken(`${inchRange[2]}"`)?.inch ?? null;
      if (lo !== null && hi !== null) (env.size_inch >= lo && env.size_inch <= hi ? hits : conflicts).push("size");
    } else if (dnRange) {
      const dn = env.size_dn ?? (env.size_inch !== null ? inchToDn(env.size_inch) : null);
      if (dn !== null) (dn >= Number(dnRange[1]) && dn <= Number(dnRange[2]) ? hits : conflicts).push("size");
    }
  }
  if (env.pressure_bar !== null || env.pressure_class) {
    // A stated rating covers the order when it is at least the required rating; classes compare as classes or through their bar equivalent.
    const stated: { bar: number | null; klass: string | null }[] = [];
    for (const [k, v] of entries) {
      if (!(/pressure|rating|pn\b|class/i.test(k) || /\b(?:PN\s*\d+|class\s*\d{3,4}|\d+\s*bar)\b/i.test(v))) continue;
      const tokens = [...v.matchAll(/PN\s*\d+(?:[.,]\d+)?|class\s*\d{3,4}|CL\s*\d{3,4}|\d+(?:[.,]\d+)?\s*(?:bar|psi|MPa)/gi)].map((m) => m[0]);
      // "Class / Pressure: 150, 300, 600": bare class numbers listed under a class-like key.
      if (!tokens.length && /class/i.test(`${k} ${v}`)) tokens.push(...[...v.matchAll(/\b(150|300|400|600|900|1500|2500)\b/g)].map((m) => `class ${m[1]}`));
      for (const tok of tokens) {
        const mpa = tok.match(/^(\d+(?:[.,]\d+)?)\s*MPa$/i);
        const r = mpa ? { bar: Number(mpa[1]!.replace(",", ".")) * 10, klass: null } : parsePressureToken(tok);
        if (r) stated.push(r);
      }
    }
    if (stated.length) {
      const needBar = env.pressure_bar ?? (env.pressure_class ? CLASS_BAR[env.pressure_class] ?? null : null);
      const ok = stated.some((r) => {
        if (env.pressure_class && r.klass) return Number(r.klass) >= Number(env.pressure_class);
        const bar = r.bar ?? (r.klass ? CLASS_BAR[r.klass] ?? null : null);
        return needBar !== null && bar !== null && bar >= needBar - 0.5;
      });
      (ok ? hits : conflicts).push("pressure");
    }
  }
  if (env.connection) {
    const stated = entries.filter(([k]) => /connection|ends?\b/i.test(k)).map(([, v]) => canonConnection(v)).filter(Boolean);
    if (stated.length) (stated.includes(env.connection as never) ? hits : conflicts).push("connection");
  }
  return { ok: conflicts.length === 0, hits, conflicts };
}

/** Subheadings that are catch-alls ("other valves", "other pumps", "other fittings"): the product title must name the order's object class there. */
const CATCH_ALL = new Set(["848100", "848180", "841300", "841381", "841370", "730700", "730710", "730729", "730790", "730799"]);

/**
 * Matched at the stated specification: same subheading, at least one stated attribute agreeing with
 * the envelope and none conflicting, and on a catch-all subheading the product title naming the
 * order's object class (a stainless gate valve does not cover a stainless ball valve order).
 */
export function atSpec(order: { hs6: string; envelope: Envelope }, cap: CapabilityCandidate): boolean {
  if (cap.hs6 !== order.hs6) return false;
  const spec = specCompatible(order.envelope, cap.spec_attrs ?? {});
  if (!spec.ok || spec.hits.length === 0) return false;
  if (!CATCH_ALL.has(order.hs6)) return true;
  const wanted = headTokens(productTokens(order.envelope.object_class ?? ""));
  if (wanted.length === 0) return true;
  const stated = productTokens(`${cap.product_title ?? ""} ${cap.spec_attrs?.type ?? ""}`);
  return wanted.every((w) => stated.includes(w));
}

/** The order's object class named in the capability's title or stated type, with nothing in conflict: a rung between category level and at spec. */
export function atType(order: { hs6: string; envelope: Envelope }, cap: CapabilityCandidate): boolean {
  if (cap.hs6 !== order.hs6) return false;
  if (!specCompatible(order.envelope, cap.spec_attrs ?? {}).ok) return false;
  const wanted = headTokens(productTokens(order.envelope.object_class ?? ""));
  if (wanted.length === 0) return true;
  if (!CATCH_ALL.has(order.hs6)) return true;
  const stated = productTokens(`${cap.product_title ?? ""} ${cap.spec_attrs?.type ?? ""}`);
  return wanted.every((w) => stated.includes(w));
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
