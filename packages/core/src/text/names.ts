const AR_BOILER = new Set(["شركه", "شركة", "مصنع", "مؤسسه", "مؤسسة", "المحدوده", "المحدودة", "للصناعه", "للصناعة", "للتجاره", "للتجارة", "التجاريه", "التجارية", "شخص", "واحد", "ذات", "مسؤوليه", "مسؤولية", "محدوده", "محدودة", "فرع", "و"]);
const EN_BOILER = new Set(["company", "co", "ltd", "llc", "limited", "factory", "est", "establishment", "for", "and", "of", "the", "sharikat", "masna", "lil", "shakhs", "wahid", "group", "industrial", "industries", "industry", "trading", "bin", "ibn", "al"]);

export function normaliseArabic(s: string): string {
  const t = s
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^؀-ۿ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !AR_BOILER.has(w))
    .join(" ");
  return t.trim();
}

/** Consonant skeleton for transliterated names: drop Arabic article prefixes, keep the first letter, drop the other vowels, collapse doubles. */
const fold = (w: string): string => {
  const base = w.length >= 6 ? w.replace(/^(lil|wal|bil|al|el)(?=[a-z]{3,})/, "") : w;
  return (base[0] ?? "") + base.slice(1).replace(/[aeiouy]/g, "").replace(/(.)\1+/g, "$1");
};
const enTokens = (s: string): string[] => s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !EN_BOILER.has(w)).map(fold);
const arTokens = (s: string): string[] => normaliseArabic(s).split(/\s+/).filter(Boolean).map((w) => w.replace(/^(ال|لل|وال|بال)/, ""));

export function nameSimilarity(a: string, b: string): number {
  const ta = new Set([...arTokens(a), ...enTokens(a)]);
  const tb = new Set([...arTokens(b), ...enTokens(b)]);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}
