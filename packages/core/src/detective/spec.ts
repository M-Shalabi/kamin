/**
 * The Specifier: a Detective pass that reads a supplier's catalogues and datasheets for the
 * specifications its products are actually stated at (type, sizes, pressure ratings, materials,
 * connections, standards), and writes them onto the matching capabilities as attributes with
 * evidence. This is what turns category-level coverage into coverage at the stated specification.
 */
import type { Sql } from "postgres";
import { z } from "zod";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getChatModel, modelRefFor } from "../models/registry";
import { invokeStructured } from "../models/structured";
import { addStep } from "../trajectory/store";
import { withRun } from "../trajectory/handler";
import { searchTavily, type TavilyResult } from "../web/tavily";
import { fetchText } from "../web/fetch";
import { anchorFinding, evidenceTier, ownHosts } from "./anchor";
import { loadProfile } from "./persist";
import { nameTokens, type SupplierProfile } from "./queries";
import { classifyUrl } from "./select";
import { mergeRelations, RelationsLoose, PREDICATES, type Relation } from "../graph/relations";

const FAMILY_WORD: Record<string, string> = { "8481": "valves", "8413": "pumps", "7307": "pipe fittings flanges" };

/** Up to five searches: the supplier's own site for catalogues and datasheets, then its name with the sector's words. */
export function specQueries(profile: SupplierProfile, hs6s: string[]): string[] {
  const words = [...new Set(hs6s.map((h) => FAMILY_WORD[h.slice(0, 4)] ?? "products"))].join(" ");
  const brand = nameTokens(profile).filter((t) => /^[a-z]+$/.test(t)).slice(0, 3).join(" ") || profile.name_en || "";
  const host = profile.website ? (() => { try { return new URL(/^https?:\/\//i.test(profile.website!) ? profile.website! : `https://${profile.website}`).hostname.replace(/^www\./, ""); } catch { return null; } })() : null;
  const q: string[] = [];
  if (host) { q.push(`site:${host} catalogue OR catalog OR datasheet OR "data sheet" ${words}`); q.push(`site:${host} ${words} specifications pressure rating material size`); }
  q.push(`"${brand}" ${words} catalogue pdf`);
  q.push(`"${brand}" ${words} datasheet specifications Saudi Arabia`);
  return q.slice(0, 5);
}

export type DocCandidate = { url: string; title: string; snippet: string; text: string | null; kind: "pdf" | "product" | "page"; own: boolean; tier: 1 | 2 | 3; score: number };

/** Rank search results as specification sources: PDFs first, then product and catalogue pages, own site before third parties; social and news hosts are dropped. */
export function selectDocuments(profile: SupplierProfile, results: TavilyResult[], max = 4): DocCandidate[] {
  const tokens = nameTokens(profile);
  const own = ownHosts(profile.website);
  const seen = new Set<string>();
  const docs: DocCandidate[] = [];
  for (const r of results) {
    if (!r.url || seen.has(r.url)) continue;
    seen.add(r.url);
    const { kind, tier } = classifyUrl(r.url, tokens);
    if (kind === "social" || kind === "news") continue;
    let host = ""; try { host = new URL(r.url).hostname.toLowerCase().replace(/^www\./, ""); } catch { continue; }
    const isOwn = own.some((o) => host === o || host.endsWith(`.${o}`)) || kind === "own_site";
    const isPdf = /\.pdf(?:$|[?#])/i.test(r.url);
    // A third-party document is only about this supplier when it names it; regulations and generic catalogues are not evidence.
    const haystack = `${r.url} ${r.title} ${r.content}`.toLowerCase();
    const named = tokens.some((t) => t.length >= 4 && haystack.includes(t.toLowerCase()));
    if (!isOwn && !named) continue;
    const productish = /product|catalog|catalogue|datasheet|data-sheet|download|brochure|valve|pump|fitting|flange/i.test(`${r.url} ${r.title}`);
    // Third-party pages must look like documents; the supplier's own pages always count, a homepage links to the catalogues.
    if (!isPdf && !productish && !isOwn) continue;
    const rank = (isPdf ? 100 : productish ? 50 : 0) + (isOwn ? 20 : 0) + r.score;
    docs.push({ url: r.url, title: r.title, snippet: r.content, text: r.raw_content, kind: isPdf ? "pdf" : productish ? "product" : "page", own: isOwn, tier: isOwn ? 3 : tier, score: rank });
  }
  return docs.sort((a, b) => b.score - a.score).slice(0, max);
}

/** Links worth following one level down from a product page: same-host PDFs first, then catalogue, datasheet, download or brochure pages, skipping pages already read. */
export function pickCatalogueLinks(links: string[], own: string[], alreadyRead: Set<string>, max = 4): string[] {
  const scored: { url: string; score: number }[] = [];
  for (const url of new Set(links)) {
    if (alreadyRead.has(url)) continue;
    let host = ""; try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { continue; }
    if (!own.some((o) => host === o || host.endsWith(`.${o}`))) continue;
    const isPdf = /\.pdf(?:$|[?#])/i.test(url);
    const catalogueish = /catalog|catalogue|datasheet|data-sheet|download|brochure|technical|specification/i.test(url);
    const productish = /product|valve|pump|fitting|flange|range|solution/i.test(url);
    if (!isPdf && !catalogueish && !productish) continue;
    scored.push({ url, score: (isPdf ? 10 : 0) + (catalogueish ? 2 : 0) + (productish ? 1 : 0) });
  }
  return scored.sort((a, b) => b.score - a.score).map((x) => x.url).slice(0, max);
}

export const SpecFindings = z.object({
  is_same_company: z.boolean().describe("Whether the documents belong to this supplier and not a namesake"),
  products: z.array(z.object({
    product: z.string().describe("Product line in English, for example 'ball valves'"),
    type: z.string().nullable().describe("The type within the family: ball, gate, globe, check, butterfly, safety, centrifugal, submersible, elbow, tee, flange…"),
    hs6_guess: z.string().nullable().describe("Six-digit HS subheading if you can tell"),
    sizes: z.string().nullable().describe("Stated size range, verbatim, for example 'DN15 to DN300' or '1/2 to 12 inch'"),
    pressure: z.string().nullable().describe("Stated pressure ratings, verbatim, for example 'PN16, PN40' or 'class 150 to 600'"),
    materials: z.string().nullable().describe("Stated body materials and grades, verbatim"),
    connections: z.string().nullable().describe("Stated end connections: flanged, threaded, butt weld, socket weld, wafer…"),
    standards: z.string().nullable().describe("Standards named for this line: API, ASME, ISO, BS, DIN, SASO…"),
    evidence: z.array(z.object({ url: z.string(), excerpt: z.string().describe("Up to 300 characters quoted from the document stating the specification") })),
  })),
  relations: z.array(z.object({
    predicate: z.enum(PREDICATES).describe("distributes_brand (a brand it is dealer or distributor of), part_of_group (its parent group), certified_by (a certifier or scheme named), meets_standard (a standard its lines are built to), makes_with_material, uses_process"),
    object: z.string().describe("The brand, group, certifier, standard, material or process, as written"),
    url: z.string().nullable(), excerpt: z.string().nullable().describe("Up to 200 characters quoted"),
  })).describe("Relations the documents state about the company itself"),
});
export type SpecFindingsT = z.infer<typeof SpecFindings>;

const jsonish = (v: unknown): unknown => { if (typeof v !== "string" || !/^\s*[\[{]/.test(v)) return v; try { return JSON.parse(v); } catch { return v; } };
const arr = (v: unknown): unknown[] => { const x = jsonish(v); return Array.isArray(x) ? x : []; };
const rec = (v: unknown): Record<string, unknown> => { const x = jsonish(v); return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {}; };
const str = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : Array.isArray(v) ? v.map(String).join(", ") : String(v));
const bool = (v: unknown): boolean => v === true || /^(true|yes|y)$/i.test(String(v).trim());

export const SpecFindingsLoose: z.ZodType<SpecFindingsT> = z.preprocess((raw) => {
  const r = rec(raw);
  return {
    is_same_company: bool(r.is_same_company ?? true),
    relations: RelationsLoose.parse(r.relations ?? []),
    products: arr(r.products).map((p) => {
      const x = rec(p);
      const code = (str(x.hs6_guess) ?? "").replace(/[^\d]/g, "").slice(0, 6);
      return {
        product: str(x.product) ?? "unspecified product", type: str(x.type), hs6_guess: code.length === 6 ? code : null,
        sizes: str(x.sizes ?? x.size), pressure: str(x.pressure ?? x.rating ?? x.pressure_rating), materials: str(x.materials ?? x.material), connections: str(x.connections ?? x.connection ?? x.ends), standards: str(x.standards ?? x.standard),
        evidence: arr(x.evidence).map((e) => { const y = rec(e); return { url: str(y.url) ?? "", excerpt: (str(y.excerpt) ?? "").slice(0, 300) }; }).filter((e) => e.url),
      };
    }),
  };
}, SpecFindings);

/** The attribute keys the matcher reads (see match/score.ts): type, size, pressure, material, connection, standard. */
export function toSpecAttrs(p: { product: string; type: string | null; sizes: string | null; pressure: string | null; materials: string | null; connections: string | null; standards: string | null }): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.type) out.type = p.type;
  if (p.sizes) out.size = p.sizes;
  if (p.pressure) out.pressure = p.pressure;
  if (p.materials) out.material = p.materials;
  if (p.connections) out.connection = p.connections;
  if (p.standards) out.standard = p.standards;
  return out;
}

const DOC_BUDGET = 14_000;

export function specPrompt(profile: SupplierProfile, docs: DocCandidate[]): { system: string; human: string } {
  let budget = DOC_BUDGET;
  const body = docs.map((d, i) => { const t = (d.text ?? d.snippet).slice(0, Math.max(0, Math.min(7000, budget))); budget -= t.length; return `### Document ${i + 1}: ${d.title}\nURL: ${d.url}\nKind: ${d.kind}${d.own ? " (supplier's own site)" : ""}\n${t}`; }).join("\n\n");
  return {
    system: [
      "You read manufacturers' catalogues and datasheets for a Saudi industrial buyer. Extract every product line of valves, pumps or pipe fittings with the specifications the documents actually state: type, size range, pressure ratings, materials, end connections, standards.",
      "Quote sizes, pressures and materials verbatim as ranges or lists; never infer a rating the text does not state. One product line per distinct type. Give evidence as short verbatim excerpts with the document URL.",
      "Also list what the documents state about the company itself as relations: brands it distributes or represents, the group it belongs to, certifiers or schemes named (ISO, SASO, API monogram, UL, FM), standards its lines are built to, materials it works in, processes it runs (casting, forging, machining, assembly). Only what is written; empty when nothing is.",
      "Documents marked as the supplier's own site belong to the supplier even when the brand name on them differs from the registered company name (registries carry legal names, websites carry brands): is_same_company is true for them. Only a third-party document about a different company makes is_same_company false; if every document is the supplier's own site, is_same_company is true.",
      "/no_think",
    ].join("\n"),
    human: `Company: ${profile.name_en ?? ""} | ${profile.name_ar ?? ""} (${profile.city_en ?? "city unknown"})\nWebsite on record: ${profile.website ?? "none"}\nDeclared lines: ${profile.declared.map((d) => `HS ${d.hs6} ${d.title_en}`).join("; ") || "none"}\n\nDocuments:\n${body}`,
  };
}

/** Attach stated specifications to the supplier's capabilities: anchor each product line, merge its attributes, add catalogue evidence, and queue the capability for a fresh audit. */
export async function mergeSpecFindings(db: Sql, profile: SupplierProfile, f: SpecFindingsT, runId: string, docs: DocCandidate[]): Promise<{ products: number; attributed: number; evidence: number; created: number }> {
  const docTier = new Map(docs.map((d) => [d.url, d.tier]));
  const own = ownHosts(profile.website);
  const tokens = nameTokens(profile);
  let attributed = 0, evidence = 0, created = 0;
  await db.begin(async (tx) => {
    await tx`delete from evidence where run_id = ${runId}`;
    for (const p of f.products) {
      const attrs = toSpecAttrs(p);
      if (!Object.keys(attrs).length) continue;
      const anchor = anchorFinding(`${p.type ?? ""} ${p.product}`.trim(), profile.declared, p.hs6_guess);
      if (!anchor) continue;
      const [existing] = await tx<{ id: string }[]>`select id from capabilities where supplier_id = ${profile.id} and hs6 = ${anchor.hs6} order by (verdict = 'supported') desc, (origin = 'tarmeez') desc, created_at limit 1`;
      let id = existing?.id;
      if (!id) {
        const [row] = await tx<{ id: string }[]>`insert into capabilities (supplier_id, tariff_code, hs6, product_title, spec_attrs, class, origin) values (${profile.id}, null, ${anchor.hs6}, ${p.product.trim()}, ${tx.json(attrs as never)}, 'manufacturer', 'detective') on conflict (supplier_id, hs6, lower(product_title)) where tariff_code is null do update set updated_at = now() returning id`;
        id = row!.id; created++;
      }
      await tx`update capabilities set spec_attrs = coalesce(spec_attrs, '{}'::jsonb) || ${tx.json(attrs as never)}, product_title = coalesce(product_title, ${p.product.trim()}), audit_run_id = null, updated_at = now() where id = ${id}`;
      attributed++;
      for (const e of p.evidence) {
        const tier = evidenceTier(e.url, "catalogue", own, docTier.get(e.url) ?? classifyUrl(e.url, tokens).tier);
        await tx`insert into evidence (capability_id, tier, source_type, source_url, excerpt, run_id, title) values (${id}, ${tier}, 'catalogue', ${e.url}, ${e.excerpt}, ${runId}, ${docs.find((d) => d.url === e.url)?.title ?? null})`;
        evidence++;
      }
    }
  });
  return { products: f.products.length, attributed, evidence, created };
}

export async function runSpecifier(db: Sql, supplierId: string, opts: { sink?: (line: string) => void; hs6s?: string[]; deep?: boolean } = {}): Promise<{ runId: string; findings: SpecFindingsT; merged: { products: number; attributed: number; evidence: number; created: number } }> {
  const profile = await loadProfile(db, supplierId);
  const hs6s = opts.hs6s ?? (await db<{ hs6: string }[]>`select distinct hs6 from capabilities where supplier_id = ${supplierId} and left(hs6, 4) in ('8481', '8413', '7307')`).map((r) => r.hs6);
  return withRun(db, { role: "specifier", inputRef: supplierId, model: modelRefFor("detective") }, async (runId, handler) => {
    const results: TavilyResult[] = [];
    for (const q of specQueries(profile, hs6s)) {
      const t = Date.now();
      try { const r = await searchTavily(q, { maxResults: 6 }); results.push(...r); await addStep(db, runId, { kind: "retrieval", name: "tavily_search", input: { query: q }, output: r.map((x) => ({ url: x.url, title: x.title })), durationMs: Date.now() - t }); }
      catch (err) { await addStep(db, runId, { kind: "error", name: "tavily_search", input: { query: q }, output: (err as Error).message, durationMs: Date.now() - t }); }
    }
    const docs = selectDocuments(profile, results, 4);
    const linksSeen: string[] = [];
    for (const d of docs) {
      const t = Date.now();
      const page = await fetchText(d.url, { maxChars: 9000 });
      if (page?.text) { d.text = page.text; if (page.title && d.kind === "pdf") d.title = page.title; }
      if (page?.links && d.own) linksSeen.push(...page.links);
      await addStep(db, runId, { kind: "tool_call", name: "fetch_document", input: { url: d.url, kind: d.kind }, output: { chars: d.text?.length ?? 0, title: d.title, links: page?.links?.length ?? 0 }, durationMs: Date.now() - t });
    }
    if (opts.deep) {
      // One level down: the catalogue and datasheet links the product pages point at, on the supplier's own site.
      const own = ownHosts(profile.website, ...docs.filter((d) => d.own).map((d) => d.url));
      const extra = pickCatalogueLinks(linksSeen, own, new Set(docs.map((d) => d.url)), 4);
      for (const url of extra) {
        const t = Date.now();
        const page = await fetchText(url, { maxChars: 9000 });
        const isPdf = /\.pdf(?:$|[?#])/i.test(url);
        if (page?.text) docs.push({ url, title: page.title ?? url, snippet: "", text: page.text, kind: isPdf ? "pdf" : "product", own: true, tier: 3, score: 0 });
        await addStep(db, runId, { kind: "tool_call", name: "fetch_linked_document", input: { url, kind: isPdf ? "pdf" : "page" }, output: { chars: page?.text?.length ?? 0, title: page?.title ?? null }, durationMs: Date.now() - t });
      }
    }
    let findings: SpecFindingsT = { is_same_company: false, products: [], relations: [] };
    if (docs.some((d) => d.text)) {
      const p = specPrompt(profile, docs.filter((d) => d.text));
      findings = await invokeStructured(getChatModel("detective"), [new SystemMessage(p.system), new HumanMessage(p.human)], {
        name: "spec_findings", description: "Product lines with the specifications stated in the documents", toolSchema: SpecFindings, parseSchema: SpecFindingsLoose, preferJsonText: true,
        config: { callbacks: [handler], runName: "specify" }, onRetry: (issues) => addStep(db, runId, { kind: "note", name: "specify_retry", output: { issues } }),
      });
    } else {
      await addStep(db, runId, { kind: "note", name: "no_documents", output: { queries: specQueries(profile, hs6s).length } });
    }
    // Own-site documents are the supplier's by definition; the model's same-company judgement only applies to third-party documents.
    if (!findings.is_same_company && docs.some((d) => d.own && d.text) && findings.products.length) findings = { ...findings, is_same_company: true };
    let merged = { products: findings.products.length, attributed: 0, evidence: 0, created: 0 };
    if (findings.is_same_company && findings.products.length) merged = await mergeSpecFindings(db, profile, findings, runId, docs);
    const relations = findings.is_same_company ? await mergeRelations(db, supplierId, findings.relations as Relation[], runId) : 0;
    await addStep(db, runId, { kind: "note", name: "specified", output: { ...merged, relations, is_same_company: findings.is_same_company, documents: docs.length } });
    return { runId, findings, merged };
  }, { sink: opts.sink });
}
