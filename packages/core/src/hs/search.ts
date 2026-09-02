import type { Sql } from "postgres";
import { getEmbeddings } from "../models/registry";

export type HsHit = { code: string; title_en: string; title_ar: string; distance: number };
export type HsHeadingHit = { code: string; title_en: string; title_ar: string; distance: number | null; via: "seed" | "vector" | "lexical" | "both" };
export type HsCandidates = { headings: HsHeadingHit[]; candidates: HsHit[]; queries: { objectClass: string; description: string; family?: string; terms: string[] } };

/** HS chapter structure: the headings each object family lives under. Seeds guarantee the core headings are always on the candidate list. */
export const FAMILY_SEED_HEADINGS: Record<string, string[]> = {
  valve: ["8481"],
  pump: ["8413", "8414"],
  flange: ["7307", "7412", "3917"],
  fitting: ["7307", "7412", "3917", "7609", "7507"],
};

export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

export function hsEmbeddingText(row: { title_en: string; title_ar: string; parentTitleEn?: string | null }): string {
  const parts = [row.title_en.trim(), row.title_ar.trim()];
  if (row.parentTitleEn) parts.push(`Category: ${row.parentTitleEn.trim()}`);
  return parts.join(". ");
}

const STOP = new Set(["the", "and", "for", "with", "from", "of", "to", "in", "a", "an", "or", "per", "at", "by", "on", "inch", "inches", "mm", "cm", "bar", "psi", "pn", "dn", "class", "kw", "hp", "kg", "ton", "tons", "pcs", "pieces", "unit", "units", "degree", "degrees"]);

export function lexicalTerms(text: string): string[] {
  const out: string[] = [];
  for (const t of text.toLowerCase().split(/[^a-z]+/)) {
    if (t.length >= 3 && !STOP.has(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

export async function searchHs(db: Sql, embedding: number[], k = 8, level: 4 | 6 = 6): Promise<HsHit[]> {
  const lit = toVectorLiteral(embedding);
  const rows = await db<{ code: string; title_en: string; title_ar: string; distance: number | string }[]>`
    select code, title_en, title_ar, (embedding <=> ${lit}::vector) as distance
    from hs_codes
    where level = ${level} and embedding is not null
    order by embedding <=> ${lit}::vector
    limit ${k}`;
  return rows.map((r) => ({ ...r, distance: Number(r.distance) }));
}

export async function lexicalHeadings(db: Sql, terms: string[], k = 4): Promise<{ code: string; title_en: string; title_ar: string; rank: number }[]> {
  if (!terms.length) return [];
  const q = terms.join(" | ");
  const rows = await db<{ code: string; title_en: string; title_ar: string; rank: number | string }[]>`
    with hits as (
      select case when c.level = 4 then c.code else c.parent_code end as heading,
             ts_rank(to_tsvector('english', c.title_en), to_tsquery('english', ${q})) as rank
      from hs_codes c
      where c.level in (4, 6) and to_tsvector('english', c.title_en) @@ to_tsquery('english', ${q})
    )
    select h.code, h.title_en, h.title_ar, max(hits.rank) as rank
    from hits join hs_codes h on h.code = hits.heading
    group by h.code, h.title_en, h.title_ar
    order by rank desc
    limit ${k}`;
  return rows.map((r) => ({ ...r, rank: Number(r.rank) }));
}

export async function retrieveHsCandidates(db: Sql, q: { objectClass: string; description: string; family?: string }, opts: { headingsPerQuery?: number; maxHeadings?: number; maxCandidates?: number } = {}): Promise<HsCandidates> {
  const headingsPerQuery = opts.headingsPerQuery ?? 4;
  const maxHeadings = opts.maxHeadings ?? 9;
  const maxCandidates = opts.maxCandidates ?? 60;
  const embeddings = getEmbeddings();
  const [classVec, descVec] = await Promise.all([embeddings.embedQuery(q.objectClass), embeddings.embedQuery(q.description)]);
  const [byClass, byDesc] = await Promise.all([searchHs(db, classVec, headingsPerQuery, 4), searchHs(db, descVec, headingsPerQuery, 4)]);
  const FAMILY_NOUNS = ["valve", "valves", "pump", "pumps", "flange", "flanges", "fitting", "fittings", "elbow", "tee", "nipple", "coupling", "gasket", "bolt", "pipe", "tube"];
  const terms = [...new Set([...lexicalTerms(q.objectClass), ...lexicalTerms(q.description).filter((t) => FAMILY_NOUNS.includes(t))])];
  const lexical = await lexicalHeadings(db, terms, headingsPerQuery + 2);

  const merged = new Map<string, HsHeadingHit>();
  for (const h of [...byClass, ...byDesc]) {
    const prev = merged.get(h.code);
    if (!prev || (prev.distance ?? 1) > h.distance) merged.set(h.code, { code: h.code, title_en: h.title_en, title_ar: h.title_ar, distance: h.distance, via: "vector" });
  }
  for (const h of lexical) {
    const prev = merged.get(h.code);
    if (prev) prev.via = "both";
    else merged.set(h.code, { code: h.code, title_en: h.title_en, title_ar: h.title_ar, distance: null, via: "lexical" });
  }
  const seeds = q.family ? (FAMILY_SEED_HEADINGS[q.family] ?? []) : [];
  if (seeds.length) {
    const seedRows = await db<{ code: string; title_en: string; title_ar: string }[]>`select code, title_en, title_ar from hs_codes where level = 4 and code = any(${seeds})`;
    for (const code of seeds) {
      const row = seedRows.find((r) => r.code === code);
      if (row) merged.set(code, { code, title_en: row.title_en, title_ar: row.title_ar, distance: merged.get(code)?.distance ?? null, via: "seed" });
    }
  }
  const order = (h: HsHeadingHit) => (h.via === "seed" ? -1 + seeds.indexOf(h.code) / 100 : h.via === "both" ? 0 : h.via === "lexical" ? 1 : 2) + (h.distance ?? 0);
  const headings = [...merged.values()].sort((a, b) => order(a) - order(b)).slice(0, maxHeadings);
  if (!headings.length) return { headings, candidates: [], queries: { objectClass: q.objectClass, description: q.description, family: q.family, terms } };

  const lit = toVectorLiteral(descVec);
  const codes = headings.map((h) => h.code);
  const rows = await db<{ code: string; title_en: string; title_ar: string; distance: number | string; parent_code: string }[]>`
    select code, title_en, title_ar, parent_code, (embedding <=> ${lit}::vector) as distance
    from hs_codes
    where level = 6 and parent_code = any(${codes}) and embedding is not null
    order by array_position(${codes}::text[], parent_code), embedding <=> ${lit}::vector`;
  const candidates = rows.slice(0, maxCandidates).map((r) => ({ code: r.code, title_en: r.title_en, title_ar: r.title_ar, distance: Number(r.distance) }));
  return { headings, candidates, queries: { objectClass: q.objectClass, description: q.description, family: q.family, terms } };
}
