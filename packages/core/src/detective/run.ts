import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { Sql } from "postgres";
import { getChatModel, modelRefFor } from "../models/registry";
import { invokeStructured } from "../models/structured";
import { withRun } from "../trajectory/handler";
import { addStep } from "../trajectory/store";
import { fetchText } from "../web/fetch";
import { searchTavily } from "../web/tavily";
import { loadProfile, mergeFindings } from "./persist";
import { buildQueries, type SupplierProfile } from "./queries";
import { DetectiveFindings, DetectiveFindingsLoose, type DetectiveFindingsT } from "./schema";
import { selectPages, type PageCandidate } from "./select";

const PAGE_BUDGET = 14_000;

export function detectivePrompt(profile: SupplierProfile, pages: PageCandidate[]): { system: string; human: string } {
  const declared = profile.declared.map((d) => `- HS ${d.hs6}: ${d.title_en} | ${d.title_ar}${d.amount ? ` (declared ${d.amount} ${d.unit ?? ""}/year)` : ""}`).join("\n") || "- none declared";
  let budget = PAGE_BUDGET;
  const pageText = pages.map((p, i) => {
    const body = (p.text ?? p.snippet).slice(0, Math.max(0, Math.min(6000, budget)));
    budget -= body.length;
    return `### Page ${i + 1}: ${p.title}\nURL: ${p.url}\nKind: ${p.kind}\n${body}`;
  }).join("\n\n");
  return {
    system: [
      "You are an industrial supply-chain investigator working for a Saudi buyer. You read public evidence about one company and report what it can actually supply.",
      "Rules: never assert a capability without quoting the page that shows it; absence of evidence is a valid answer; distinguish a manufacturer (makes it), an assembler, an authorised distributor (named dealer of a brand) and a trader (imports and resells); if the pages are about a different company with a similar name, say is_same_company false and report nothing.",
      "hs6_guess must be a six-digit Harmonized System subheading: ball, gate, globe and butterfly valves 848180; check valves 848130; safety valves 848140; pressure reducing valves 848110; valve parts 848190; centrifugal pumps 841370; reciprocating pumps 841350; rotary pumps 841360; pump parts 841391; stainless flanges 730721; other steel flanges 730791; stainless butt-weld fittings 730723; other steel butt-weld fittings 730793; threaded stainless fittings 730722; copper alloy fittings 741220. Use null when unsure.",
      "Quote excerpts verbatim, at most 300 characters. Put the company's own site in website only if a page is clearly theirs.",
      "/no_think",
    ].join("\n"),
    human: `Company: ${profile.name_en ?? ""} | ${profile.name_ar ?? ""}\nCity: ${profile.city_en ?? "unknown"}, ${profile.region_en ?? ""}\nCommercial registration: ${profile.cr_number ?? "unknown"}\nDeclared in the national catalogue:\n${declared}\n\nEvidence pages:\n\n${pageText || "(no pages found)"}`,
  };
}

export async function runDetective(db: Sql, supplierId: string, opts: { sink?: (line: string) => void } = {}): Promise<{ runId: string; findings: DetectiveFindingsT; merged: { capabilities: number; evidence: number; created: number } }> {
  const profile = await loadProfile(db, supplierId);
  return withRun(db, { role: "detective", inputRef: supplierId, model: modelRefFor("detective") }, async (runId, handler) => {
    const queries = buildQueries(profile);
    const results = [];
    for (const q of queries) {
      const t = Date.now();
      try {
        const r = await searchTavily(q, { maxResults: 5 });
        results.push(...r);
        await addStep(db, runId, { kind: "retrieval", name: "tavily_search", input: { query: q }, output: r.map((x) => ({ url: x.url, title: x.title, score: x.score, raw: !!x.raw_content })), durationMs: Date.now() - t });
      } catch (err) {
        await addStep(db, runId, { kind: "error", name: "tavily_search", input: { query: q }, output: (err as Error).message, durationMs: Date.now() - t });
      }
    }
    if (profile.website) results.unshift({ title: "Own website", url: profile.website, content: "", raw_content: null, score: 1 });
    const pages = selectPages(profile, results, 4);
    for (const p of pages) {
      if (p.text) continue;
      const t = Date.now();
      const fetched = await fetchText(p.url);
      p.text = fetched?.text ?? null;
      if (fetched?.title) p.title = fetched.title;
      await addStep(db, runId, { kind: "tool_call", name: "fetch_page", input: { url: p.url }, output: { chars: p.text?.length ?? 0, title: p.title }, durationMs: Date.now() - t });
    }
    let findings: DetectiveFindingsT;
    if (!pages.length) {
      findings = { website: null, is_same_company: false, capabilities: [], certifications: [], signals: { employees: null, capacity: null, facility: null }, summary: "No public evidence found." };
      await addStep(db, runId, { kind: "note", name: "no_pages", output: { queries } });
    } else {
      const p = detectivePrompt(profile, pages);
      findings = await invokeStructured(getChatModel("detective"), [new SystemMessage(p.system), new HumanMessage(p.human)], {
        name: "detective_findings", description: "What the evidence pages show this company can supply", toolSchema: DetectiveFindings, parseSchema: DetectiveFindingsLoose,
        config: { callbacks: [handler], runName: "extract" },
        onRetry: (issues) => addStep(db, runId, { kind: "note", name: "extract_retry", output: { issues } }),
      });
    }
    let merged = { capabilities: 0, evidence: 0, created: 0 };
    if (findings.is_same_company) {
      merged = await mergeFindings(db, profile, findings, runId, pages);
    } else {
      await db`update suppliers set detective_status = 'ok', detective_run_id = ${runId}, detective_at = now(), summary = coalesce(nullif(${findings.summary}, ''), summary) where id = ${supplierId}`;
    }
    await addStep(db, runId, { kind: "note", name: "merged", output: { ...merged, is_same_company: findings.is_same_company, website: findings.website } });
    return { runId, findings, merged };
  }, { sink: opts.sink }).catch(async (err) => {
    await db`update suppliers set detective_status = 'error', detective_at = now() where id = ${supplierId}`;
    throw err;
  });
}
