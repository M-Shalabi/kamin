import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { Sql } from "postgres";
import { z } from "zod";
import { getChatModel, modelRefFor } from "../models/registry";
import { invokeStructured } from "../models/structured";
import { nameSimilarity } from "../text/names";
import { withRun } from "../trajectory/handler";
import { addStep } from "../trajectory/store";
import { searchTavily } from "../web/tavily";

export const HUNT_QUERIES: Record<"valve" | "pump" | "fitting", string[]> = {
  valve: ["مصنع صمامات في السعودية", "valve manufacturer Saudi Arabia factory Dammam Jubail Riyadh", "مصانع الصمامات الصناعية المملكة العربية السعودية قائمة"],
  pump: ["مصنع مضخات في السعودية", "pump manufacturer Saudi Arabia factory", "مصانع المضخات السعودية"],
  fitting: ["مصنع وصلات ومواسير في السعودية فلنجات", "pipe fittings flanges manufacturer Saudi Arabia factory", "مصانع الفلنجات والوصلات السعودية"],
};

const Candidates = z.object({ companies: z.array(z.object({ name: z.string(), name_arabic: z.string().nullable(), url: z.string().nullable(), city: z.string().nullable(), what: z.string().describe("one line: what the page says they make or sell"), is_manufacturer_claim: z.boolean() })) });
type CandidatesT = z.infer<typeof Candidates>;
const CandidatesLoose: z.ZodType<CandidatesT> = z.preprocess((raw) => {
  const r = raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  const list = Array.isArray(r.companies) ? r.companies : [];
  return { companies: list.map((c) => { const x = (c ?? {}) as Record<string, unknown>; return { name: String(x.name ?? "").trim(), name_arabic: x.name_arabic ? String(x.name_arabic) : null, url: x.url ? String(x.url) : null, city: x.city ? String(x.city) : null, what: String(x.what ?? ""), is_manufacturer_claim: x.is_manufacturer_claim === true || String(x.is_manufacturer_claim) === "true" }; }).filter((c) => c.name) };
}, Candidates);

export async function runHunt(db: Sql, family: "valve" | "pump" | "fitting"): Promise<{ queries: number; candidates: number; created: number }> {
  return withRun(db, { role: "detective", inputRef: `hunt:${family}`, model: modelRefFor("detective") }, async (runId, handler) => {
    const results = [];
    for (const q of HUNT_QUERIES[family]) {
      const t = Date.now();
      const r = await searchTavily(q, { maxResults: 8 });
      results.push(...r);
      await addStep(db, runId, { kind: "retrieval", name: "tavily_search", input: { query: q }, output: r.map((x) => x.url), durationMs: Date.now() - t });
    }
    const text = results.map((r, i) => `### ${i + 1}. ${r.title}\nURL: ${r.url}\n${(r.raw_content ?? r.content).slice(0, 2500)}`).join("\n\n").slice(0, 16_000);
    const found = await invokeStructured(getChatModel("detective"), [
      new SystemMessage(`You extract company names from search results. List every Saudi company these pages say makes or sells ${family}s. One entry per company, Arabic name if shown, the URL of the page that mentions it, the city if stated. Do not invent companies. /no_think`),
      new HumanMessage(text),
    ], { name: "hunt_candidates", toolSchema: Candidates, parseSchema: CandidatesLoose, preferJsonText: true, config: { callbacks: [handler], runName: "hunt_extract" } });
    const known = await db<{ id: string; name_ar: string | null; name_en: string | null }[]>`select id, name_ar, name_en from suppliers`;
    let created = 0;
    for (const c of found.companies) {
      const dup = known.find((k) => Math.max(k.name_en ? nameSimilarity(c.name, k.name_en) : 0, k.name_ar && c.name_arabic ? nameSimilarity(c.name_arabic, k.name_ar) : 0, k.name_ar ? nameSimilarity(c.name, k.name_ar) : 0) >= 0.6);
      if (dup) continue;
      const id = `hunt:${family}:${c.name.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, "-").slice(0, 60)}`;
      const [row] = await db<{ inserted: boolean }[]>`
        insert into suppliers (id, name_ar, name_en, city_en, website, source, in_tarmeez, summary, raw)
        values (${id}, ${c.name_arabic}, ${c.name}, ${c.city}, ${c.url && /^https?:/.test(c.url) ? c.url : null}, 'hunt', false, ${c.what}, ${db.json({ hunt: { family, runId, ...c } } as never)})
        on conflict (id) do nothing returning true as inserted`;
      if (row?.inserted) { created++; known.push({ id, name_ar: c.name_arabic, name_en: c.name }); }
    }
    await addStep(db, runId, { kind: "note", name: "hunt_result", output: { candidates: found.companies.length, created } });
    return { queries: HUNT_QUERIES[family].length, candidates: found.companies.length, created };
  });
}
