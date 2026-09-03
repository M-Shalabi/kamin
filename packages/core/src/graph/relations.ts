/**
 * Typed relations between entities, each with its evidence: the explicit knowledge graph over the
 * map. Suppliers, capabilities, evidence and HS nodes are already a graph in Postgres (ADR 0001);
 * this table adds the edges pages state and the Auditor and Advisor need: which brand a company
 * distributes, which group it belongs to, who certified it, which standards its lines meet.
 */
import type { Sql } from "postgres";
import { z } from "zod";
import { nameSimilarity } from "../text/names";

export const PREDICATES = ["distributes_brand", "part_of_group", "certified_by", "meets_standard", "same_entity_as", "makes_with_material", "uses_process"] as const;
export type Predicate = (typeof PREDICATES)[number];
export type Relation = { predicate: Predicate; object: string; url: string | null; excerpt: string | null };

const PREDICATE_PATTERNS: [RegExp, Predicate][] = [
  [/distribut|dealer|agent|reseller|stockist|represent|authori[sz]ed/i, "distributes_brand"],
  [/subsidiar|part of|member of|owned by|belongs to|division of|group/i, "part_of_group"],
  [/certif|accredit|approved by|registered with|iso\s*\d+/i, "certified_by"],
  [/standard|complies|compliant|conform|meets|according to|designed to|api\b|asme|ansi|iso\b|din\b|bs\s*\d|en\s*\d|saso|astm/i, "meets_standard"],
  [/same (entity|company)|also known as|formerly|trading as|brand of/i, "same_entity_as"],
  [/made of|material|body in|cast in|forged in|machined from/i, "makes_with_material"],
  [/process|casting|forging|machining|welding|coating|assembl/i, "uses_process"],
];

const STANDARD_CODE = /^(api|asme|ansi|iso|din|bs|en|astm|saso|awwa|nfpa|ul|fm|jis|ms|iec)\b/i;

/** Map a free-text predicate to one of the seven, tidy the object, or return null when it is neither. */
export function canonRelation(r: { predicate: string; object: string }): { predicate: Predicate; object: string } | null {
  const object = (r.object ?? "").replace(/\s+/g, " ").trim();
  if (!object) return null;
  const p = (r.predicate ?? "").trim();
  const predicate = (PREDICATES as readonly string[]).includes(p) ? (p as Predicate) : PREDICATE_PATTERNS.find(([re]) => re.test(p))?.[1] ?? null;
  if (!predicate) return null;
  if (predicate === "meets_standard") return { predicate, object: STANDARD_CODE.test(object) ? object.replace(/^(\w+)/, (m) => m.toUpperCase()) : object };
  if (predicate === "makes_with_material" || predicate === "uses_process") return { predicate, object: object.toLowerCase() };
  return { predicate, object };
}

const jsonish = (v: unknown): unknown => { if (typeof v !== "string" || !/^\s*[\[{]/.test(v)) return v; try { return JSON.parse(v); } catch { return v; } };
const str = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));

export const RelationsLoose: z.ZodType<Relation[]> = z.preprocess((raw) => {
  const list = jsonish(raw);
  const arr = Array.isArray(list) ? list : list && typeof list === "object" && Array.isArray((list as { relations?: unknown }).relations) ? (list as { relations: unknown[] }).relations : [];
  return arr.map((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    const c = canonRelation({ predicate: String(o.predicate ?? o.relation ?? ""), object: String(o.object ?? o.target ?? o.name ?? "") });
    return c && { ...c, url: str(o.url ?? o.source_url), excerpt: str(o.excerpt) ? String(o.excerpt).slice(0, 300) : null };
  }).filter(Boolean);
}, z.array(z.object({ predicate: z.enum(PREDICATES), object: z.string(), url: z.string().nullable(), excerpt: z.string().nullable() })));

/** Upsert edges for one subject; a group or same-entity object is linked to a supplier on the map when a name matches well enough. Returns the number of distinct edges written. */
export async function mergeRelations(db: Sql, subjectId: string, rels: Relation[], runId: string | null): Promise<number> {
  const seen = new Set<string>(); let n = 0;
  for (const r of rels) {
    const key = `${r.predicate}|${r.object.toLowerCase()}`;
    if (seen.has(key)) continue; seen.add(key);
    let objectId: string | null = null;
    if (r.predicate === "part_of_group" || r.predicate === "same_entity_as") {
      const cands = await db<{ id: string; name_en: string | null; name_ar: string | null }[]>`select id, name_en, name_ar from suppliers where id <> ${subjectId} and (name_en ilike ${"%" + r.object.split(" ")[0] + "%"} or name_ar ilike ${"%" + r.object.split(" ")[0] + "%"}) limit 50`;
      const best = cands.map((c) => ({ id: c.id, s: Math.max(c.name_en ? nameSimilarity(r.object, c.name_en) : 0, c.name_ar ? nameSimilarity(r.object, c.name_ar) : 0) })).sort((a, b) => b.s - a.s)[0];
      if (best && best.s >= 0.6) objectId = best.id;
    }
    await db`insert into relations (subject_id, predicate, object, object_id, source_url, excerpt, run_id) values (${subjectId}, ${r.predicate}, ${r.object}, ${objectId}, ${r.url}, ${r.excerpt}, ${runId})
      on conflict (subject_id, predicate, object) do update set object_id = coalesce(excluded.object_id, relations.object_id), source_url = coalesce(excluded.source_url, relations.source_url), excerpt = coalesce(excluded.excerpt, relations.excerpt), run_id = coalesce(excluded.run_id, relations.run_id)`;
    n++;
  }
  return n;
}

export async function relationsOf(db: Sql, supplierId: string): Promise<{ predicate: Predicate; object: string; object_id: string | null; source_url: string | null; excerpt: string | null }[]> {
  return db<{ predicate: Predicate; object: string; object_id: string | null; source_url: string | null; excerpt: string | null }[]>`
    select predicate, object, object_id, source_url, excerpt from relations where subject_id = ${supplierId} order by predicate, object`;
}
