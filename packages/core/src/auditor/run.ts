import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { Sql } from "postgres";
import { getChatModel, modelRefFor } from "../models/registry";
import { invokeStructured } from "../models/structured";
import { withRun } from "../trajectory/handler";
import { addStep } from "../trajectory/store";
import { AuditVerdict, AuditVerdictLoose } from "./schema";
import { lensesToVerdict } from "./verdict";

export type CapabilityForAudit = {
  id: string; supplier_id: string; supplier_name_en: string | null; supplier_name_ar: string | null; city_en: string | null; supplier_summary: string | null; cr_number: string | null;
  hs6: string; product_title: string | null; product_en: string | null; class: string; spec_attrs: Record<string, string>; declared_amount: number | null; declared_unit: string | null; origin: string;
  evidence: { tier: number; source_type: string; source_url: string; excerpt: string | null; title: string | null }[];
};

export async function loadCapability(db: Sql, capabilityId: string): Promise<CapabilityForAudit> {
  const [c] = await db<Omit<CapabilityForAudit, "evidence">[]>`
    select c.id, c.supplier_id, s.name_en as supplier_name_en, s.name_ar as supplier_name_ar, s.city_en, s.summary as supplier_summary, s.cr_number,
           c.hs6, c.product_title, p.title_en as product_en, c.class, c.spec_attrs, c.declared_amount::float as declared_amount, c.declared_unit, c.origin
    from capabilities c join suppliers s on s.id = c.supplier_id left join products p on p.tariff_code = c.tariff_code
    where c.id = ${capabilityId}`;
  if (!c) throw new Error(`capability ${capabilityId} not found`);
  const evidence = await db<CapabilityForAudit["evidence"]>`select tier, source_type, source_url, excerpt, title from evidence where capability_id = ${capabilityId} order by tier, fetched_at`;
  return { ...c, evidence };
}

export function auditorPrompt(cap: CapabilityForAudit): { system: string; human: string } {
  const ev = cap.evidence.map((e, i) => `${i + 1}. [tier ${e.tier}, ${e.source_type}] ${e.source_url}\n   "${(e.excerpt ?? "").slice(0, 300)}"`).join("\n") || "(no evidence beyond the catalogue declaration)";
  return {
    system: [
      "You are an adversarial auditor for a Saudi industrial buyer. Your job is to try to REFUTE the capability claim below: that this company can put this product, at the stated specification, in a buyer's hands.",
      "Three lenses, answered separately. real: does this company exist and is it active, and does the evidence show this product at all; refute when the evidence contradicts it, say unknown when the evidence is silent. at_spec: this lens is only about the product's physical specification (type, size, material, rating, standard); supported when the evidence shows those attributes, refuted when the evidence shows a different product or only a broad category while specific attributes were claimed, unknown when no attributes are stated anywhere. local: classify how the company supplies this product, manufacturer (makes it in the Kingdom), assembler (assembles imported parts), authorised_distributor (named dealer of a brand), trader (imports and resells).",
      "Whether the company makes or imports the product is the local lens and only the local lens. Being an importer, stockist, distributor or trader is never a reason to refute real or at_spec. A tier 2 registry declaration alone means real is supported and at_spec is unknown unless attributes are stated.",
      "Think in the analysis field first, then fill every lens with a final decision and one sentence of reasoning. Never deliberate inside a lens: each lens object holds exactly its verdict or class and one sentence. Give a killer_evidence fact when you refute real, and an overall confidence between 0 and 1 in your own findings.",
      "/no_think",
    ].join("\n"),
    human: `Company: ${cap.supplier_name_en ?? ""} | ${cap.supplier_name_ar ?? ""} (${cap.city_en ?? "city unknown"}, CR ${cap.cr_number ?? "unknown"})\nWhat we know about the company: ${cap.supplier_summary ?? "nothing beyond the registry"}\n\nClaim: can supply "${cap.product_title ?? cap.product_en ?? cap.hs6}" (HS ${cap.hs6})${cap.declared_amount ? `, declared capacity ${cap.declared_amount} ${cap.declared_unit ?? ""} per year` : ""}\nClass currently on record (you decide the class in the local lens): ${cap.class}\nStated attributes: ${Object.entries(cap.spec_attrs ?? {}).map(([k, v]) => `${k}=${v}`).join(", ") || "none"}\nOrigin of the claim: ${cap.origin}\n\nEvidence:\n${ev}`,
  };
}

export async function runAuditor(db: Sql, capabilityId: string, opts: { sink?: (line: string) => void } = {}): Promise<{ runId: string; verdict: "supported" | "refuted" | "pending"; class: string; confidence: number }> {
  const cap = await loadCapability(db, capabilityId);
  return withRun(db, { role: "auditor", inputRef: capabilityId, model: modelRefFor("auditor") }, async (runId, handler) => {
    const p = auditorPrompt(cap);
    const lenses = await invokeStructured(getChatModel("auditor"), [new SystemMessage(p.system), new HumanMessage(p.human)], {
      name: "audit_verdict", description: "The three-lens audit of one capability claim", toolSchema: AuditVerdict, parseSchema: AuditVerdictLoose, preferJsonText: true,
      config: { callbacks: [handler], runName: "audit" },
      onRetry: (issues) => addStep(db, runId, { kind: "note", name: "audit_retry", output: { issues } }),
    });
    const { clearAttrs, ...result } = lensesToVerdict(lenses, cap.evidence.map((e) => e.tier), { attrsClaimed: Object.keys(cap.spec_attrs ?? {}).length > 0 });
    await db`update capabilities set verdict = ${result.verdict}, class = ${result.class}, confidence = ${result.confidence}, class_confidence = ${lenses.confidence}, lenses = ${db.json(lenses as never)}, spec_attrs = case when ${clearAttrs} then '{}'::jsonb else spec_attrs end, audit_run_id = ${runId}, audited_at = now(), status = 'audited', updated_at = now() where id = ${capabilityId}`;
    await addStep(db, runId, { kind: "note", name: "verdict", output: { ...result, killer_evidence: lenses.real.killer_evidence } });
    return { runId, ...result };
  }, { sink: opts.sink });
}
