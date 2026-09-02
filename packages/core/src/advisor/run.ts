import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { Sql } from "postgres";
import type { Envelope } from "../coordinator/pool";
import { getChatModel, modelRefFor } from "../models/registry";
import { invokeStructured } from "../models/structured";
import { withRun } from "../trajectory/handler";
import { addStep } from "../trajectory/store";
import { InvestmentCase, InvestmentCaseLoose, type InvestmentCaseT } from "./schema";

export type Adjacent = { supplier_id: string; name: string; hs6: string; product: string; class: string; relation: string; region: string | null };
type OrderForAdvice = { id: string; hs6: string; title: string; family: string | null; annual_value_usd: number | null; qty_annual: number | null; portco_count: number; mandatory: boolean; spec_envelope: Envelope };

const RELATED: Record<string, string[]> = { "8481": ["7307", "8413", "7412"], "8413": ["8481", "8414"], "7307": ["8481", "7412", "7304", "7306"], "7412": ["7307", "8481"] };

export async function adjacentSuppliers(db: Sql, order: { hs6: string; spec_envelope: Envelope }, opts: { onlySupplierIds?: string[] } = {}): Promise<Adjacent[]> {
  const heading = order.hs6.slice(0, 4);
  const related = RELATED[heading] ?? [];
  const filter = opts.onlySupplierIds ? db`and c.supplier_id = any(${opts.onlySupplierIds})` : db`and c.supplier_id not like 'test:%'`;
  const rows = await db<{ supplier_id: string; name: string; hs6: string; product: string; class: string; region: string | null; best_tier: number | null; spec_attrs: Record<string, string> }[]>`
    select c.supplier_id, coalesce(s.name_en, s.name_ar, s.id) as name, c.hs6, coalesce(c.product_title, p.title_en, c.hs6) as product, c.class, s.region_en as region, e.best_tier, c.spec_attrs
    from capabilities c join suppliers s on s.id = c.supplier_id left join products p on p.tariff_code = c.tariff_code
    left join (select capability_id, min(tier)::int as best_tier from evidence group by capability_id) e on e.capability_id = c.id
    where c.verdict = 'supported' and e.best_tier <= 2 and (left(c.hs6, 4) = ${heading} or left(c.hs6, 4) = any(${related})) ${filter}`;
  const material = order.spec_envelope.material ?? "";
  const score = (r: (typeof rows)[number]) => {
    const maker = r.class === "manufacturer" || r.class === "assembler";
    const sameHeading = r.hs6.slice(0, 4) === heading;
    const mat = material && JSON.stringify(r.spec_attrs ?? {}).toLowerCase().includes(material.split("_")[0]!) ? 1 : 0;
    return (maker ? 4 : 0) + (sameHeading ? (maker ? 1 : 2) : 3) + mat;
  };
  return rows
    .map((r) => ({ r, s: score(r) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map(({ r }) => ({ supplier_id: r.supplier_id, name: r.name, hs6: r.hs6, product: r.product, class: r.class, region: r.region,
      relation: r.hs6.slice(0, 4) === heading ? (r.class === "manufacturer" || r.class === "assembler" ? "already makes a product under this heading" : `supplies this heading as a ${r.class.replace(/_/g, " ")}`) : `makes ${r.product} under related heading ${r.hs6.slice(0, 4)}, similar materials and processes` }));
}

export function advisorPrompt(order: OrderForAdvice, adjacent: Adjacent[], mining: { name_en: string | null; website: string | null }[], imports: { value_usd: number } | null): { system: string; human: string } {
  const adj = adjacent.map((a, i) => `${i + 1}. ${a.name} (${a.supplier_id}), ${a.region ?? "region unknown"}: ${a.product} [HS ${a.hs6}], ${a.class.replace(/_/g, " ")}; ${a.relation}`).join("\n") || "(no adjacent supported capability on record)";
  const mines = mining.slice(0, 12).map((m) => m.name_en).filter(Boolean).join("; ") || "none on record";
  return {
    system: [
      "You are an industrial investment advisor to PIF's local content team. You turn one gap in domestic supply into a one-paragraph investment case grounded only in the facts given.",
      "Pivot candidates must come from the adjacent suppliers listed; never invent a company. Explain what each already has and what it would need. Use the mining companies only as raw-material context and say 'unknown' when the link is not evident.",
      "Numbers: use the annual value given. Regulatory pressure: state the Mandatory List status given. Keep every field concise.",
      "/no_think",
    ].join("\n"),
    human: `Gap: ${order.title} (HS ${order.hs6}, family ${order.family ?? "unknown"})\nPooled annual demand across ${order.portco_count} portfolio companies: ${order.qty_annual ? Math.round(order.qty_annual).toLocaleString("en-US") + " units, " : ""}USD ${Math.round(order.annual_value_usd ?? 0).toLocaleString("en-US")} per year\nNational imports 2024 for this subheading: USD ${imports ? Math.round(imports.value_usd).toLocaleString("en-US") : "unknown"}\nMandatory List: ${order.mandatory ? "yes, this heading is on the announced tranche requiring minimum local content from 1 August 2027" : "not on the announced tranches"}\nSpecification envelope: ${JSON.stringify(order.spec_envelope)}\n\nAdjacent suppliers with supported capabilities:\n${adj}\n\nMining and geological companies on record: ${mines}`,
  };
}

export async function runAdvisor(db: Sql, orderId: string, opts: { onlySupplierIds?: string[] } = {}): Promise<{ runId: string; case: InvestmentCaseT }> {
  const [order] = await db<OrderForAdvice[]>`select id, hs6, coalesce(title, hs6) as title, family, annual_value_usd::float as annual_value_usd, qty_annual::float as qty_annual, portco_count, mandatory, spec_envelope from pooled_orders where id = ${orderId}`;
  if (!order) throw new Error(`pooled order ${orderId} not found`);
  const [imports] = await db<{ value_usd: number }[]>`select value_usd::float as value_usd from imports where hs6 = ${order.hs6} and year = 2024`;
  const mining = await db<{ name_en: string | null; website: string | null }[]>`select name_en, website from mining_companies order by id`;
  return withRun(db, { role: "advisor", inputRef: orderId, model: modelRefFor("advisor") }, async (runId, handler) => {
    const t = Date.now();
    const adjacent = await adjacentSuppliers(db, order, opts);
    await addStep(db, runId, { kind: "retrieval", name: "adjacent_suppliers", input: { hs6: order.hs6 }, output: adjacent.map((a) => `${a.supplier_id} ${a.class} ${a.hs6}`), durationMs: Date.now() - t });
    const p = advisorPrompt(order, adjacent, mining, imports ?? null);
    const c = await invokeStructured(getChatModel("advisor"), [new SystemMessage(p.system), new HumanMessage(p.human)], {
      name: "investment_case", description: "The investment case for closing one domestic supply gap", toolSchema: InvestmentCase, parseSchema: InvestmentCaseLoose,
      config: { callbacks: [handler], runName: "advise" },
      onRetry: (issues) => addStep(db, runId, { kind: "note", name: "advise_retry", output: { issues } }),
    });
    const known = new Set(adjacent.map((a) => a.supplier_id));
    c.pivot_candidates = c.pivot_candidates.filter((x) => known.has(x.supplier_id) || adjacent.some((a) => a.name === x.supplier_name)).map((x) => ({ ...x, supplier_id: known.has(x.supplier_id) ? x.supplier_id : adjacent.find((a) => a.name === x.supplier_name)!.supplier_id }));
    if (!c.annual_value_usd) c.annual_value_usd = order.annual_value_usd ?? 0;
    await db`insert into gap_cases (pooled_order_id, run_id, "case") values (${orderId}, ${runId}, ${db.json(c as never)}) on conflict (pooled_order_id) do update set run_id = excluded.run_id, "case" = excluded."case", created_at = now()`;
    await addStep(db, runId, { kind: "note", name: "case", output: { headline: c.headline, pivots: c.pivot_candidates.length } });
    return { runId, case: c };
  });
}
