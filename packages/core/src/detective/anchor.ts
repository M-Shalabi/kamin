/**
 * Where a Detective finding lands on the map.
 *
 * A finding such as "Swing Check Valves (Bronze)" usually comes without an HS guess. Rather than
 * creating an orphan capability under 000000 (which nothing can match), attach it to the supplier's
 * declared capability whose distinguishing words it contains, else to a sector subheading from a
 * small keyword table, else leave it unanchored. Pure functions; the merge in persist.ts calls them.
 */

const FAMILY_WORDS = new Set(["valve", "tap", "cock", "similar", "appliance", "pipe", "pump", "fitting", "tube", "other", "and", "or", "for", "of", "the", "with", "general", "model", "type", "series", "part", "n", "e", "s", "nes", "etc"]);

/** Lowercase word tokens, singularised, without codes (anything holding a digit) and filler. */
export function productTokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !/\d/.test(t)).map((t) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t)).filter((t) => !["model", "type", "series", "general", "etc", "nes"].includes(t));
}
const head = (tokens: string[]) => tokens.filter((t) => !FAMILY_WORDS.has(t));
/** "Safety or relief valves" → [["safety"], ["relief"]]: each alternative must be wholly present. */
const headGroups = (title: string): string[][] => title.toLowerCase().split(/\bor\b|,|\//).map((part) => head(productTokens(part))).filter((g) => g.length);

const has = (tokens: string[], ...words: string[]) => words.some((w) => tokens.includes(w));
const VALVE_TYPES = ["ball", "gate", "globe", "butterfly", "plug", "needle", "control", "solenoid", "diaphragm", "knife", "float", "actuated", "isolation", "hydrant", "nozzle", "faucet", "mixer", "pinch", "balancing", "regulating", "shut", "stop", "throttle", "wafer", "lug"];
const FITTING_WORDS = ["flange", "elbow", "tee", "reducer", "coupling", "nipple", "union", "cap", "bend", "cross", "sleeve", "adaptor", "adapter", "olet", "socket", "stub", "fitting", "joint"];

/** Sector keyword table: valves 8481, pumps 8413, tube and pipe fittings 7307. */
export function keywordHs6(product: string): string | null {
  const t = productTokens(product);
  const valveish = has(t, "valve") || has(t, ...VALVE_TYPES.filter((v) => ["hydrant", "faucet", "mixer"].includes(v)));
  if (valveish) {
    if (has(t, "check", "non", "nonreturn", "swing", "foot")) return "848130";
    if (has(t, "safety", "relief", "breather")) return "848140";
    if (has(t, "reducing", "regulator") && has(t, "pressure")) return "848110";
    if (has(t, "hydraulic", "oleohydraulic", "pneumatic")) return "848120";
    return "848180";
  }
  if (has(t, "pump")) {
    if (has(t, "hand", "manual")) return "841320";
    if (has(t, "dispensing", "dispenser", "fuel")) return "841311";
    if (has(t, "concrete")) return "841340";
    if (has(t, "reciprocating", "piston", "plunger", "diaphragm", "dosing", "metering")) return "841350";
    if (has(t, "rotary", "gear", "screw", "lobe", "vane", "peristaltic", "progressive")) return "841360";
    if (has(t, "centrifugal", "submersible", "booster", "circulating", "circulator", "sump", "drainage", "firefighting", "multistage", "suction", "split", "vertical", "horizontal", "sewage", "slurry", "chemical", "process")) return "841370";
    if (has(t, "impeller", "casing", "spare", "seal")) return "841391";
    return "841381";
  }
  if (has(t, ...FITTING_WORDS)) {
    const stainless = has(t, "stainless", "ss", "inox");
    const cast = has(t, "cast", "ductile", "malleable", "iron");
    const flange = has(t, "flange"), weld = has(t, "weld", "welding", "butt", "bw"), threaded = has(t, "threaded", "screwed", "npt", "bsp", "bspt");
    if (stainless) return flange ? "730721" : weld ? "730723" : threaded ? "730722" : "730729";
    if (cast) return has(t, "malleable", "ductile") ? "730719" : "730711";
    return flange ? "730791" : weld ? "730793" : threaded ? "730792" : "730799";
  }
  return null;
}

export type Anchor = { hs6: string; via: "model" | "declared" | "keyword" };

/**
 * Pick the HS6 a finding belongs to: a valid six-digit model guess wins; then the most specific
 * declared capability whose distinguishing words are all present (a generic declared line such as
 * "Taps, cocks, valves and similar appliances" only takes findings with no distinguishing words of
 * their own); then the keyword table.
 */
export function anchorFinding(product: string, declared: { hs6: string; title_en: string }[], hs6Guess?: string | null): Anchor | null {
  const guess = (hs6Guess ?? "").replace(/[^\d]/g, "");
  if (guess.length === 6 && guess !== "000000") return { hs6: guess, via: "model" };
  const tokens = productTokens(product);
  const own = head(tokens);
  let best: { hs6: string; size: number } | null = null;
  for (const d of declared) {
    const groups = headGroups(d.title_en);
    if (groups.length === 0) {
      if (own.length === 0 && (has(tokens, "valve") ? d.hs6.startsWith("8481") : has(tokens, "pump") ? d.hs6.startsWith("8413") : d.hs6.startsWith("7307"))) best ??= { hs6: d.hs6, size: 0 };
      continue;
    }
    const hit = groups.find((g) => g.every((w) => tokens.includes(w)));
    if (hit && (!best || hit.length > best.size)) best = { hs6: d.hs6, size: hit.length };
  }
  if (best) return { hs6: best.hs6, via: "declared" };
  const kw = keywordHs6(product);
  return kw ? { hs6: kw, via: "keyword" } : null;
}

const hostOf = (url: string): string | null => { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; } };
/** Hosts that belong to the supplier itself: its website plus any page classified as its own site. */
export function ownHosts(...urls: (string | null | undefined)[]): string[] {
  return [...new Set(urls.map((u) => (u ? hostOf(/^https?:\/\//i.test(u) ? u : `https://${u}`) : null)).filter((h): h is string => !!h))];
}

const TIER_BY_KIND: Record<string, 1 | 2 | 3> = { certification: 1, award: 1, registry: 2, directory: 2, catalogue: 3, website: 3, news: 3 };

/**
 * Evidence tier for one record. Anything on the supplier's own domain is self-published, Tier 3,
 * whatever it claims to be. Elsewhere the kind and the page classification each cap the tier.
 */
export function evidenceTier(url: string, kind: string, own: string[], pageTier: 1 | 2 | 3): 1 | 2 | 3 {
  const host = hostOf(url);
  if (host && own.some((o) => host === o || host.endsWith(`.${o}`))) return 3;
  return Math.min(pageTier, TIER_BY_KIND[kind] ?? 3) as 1 | 2 | 3;
}
