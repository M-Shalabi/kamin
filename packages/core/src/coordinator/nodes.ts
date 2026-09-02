import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { Sql } from "postgres";
import { retrieveHsCandidates, type HsHit } from "../hs/search";
import { addStep } from "../trajectory/store";
import type { TrajectoryHandler } from "../trajectory/handler";
import { invokeStructured } from "../models/structured";
import { HsChoiceLoose, NormalizedSpecLoose } from "./loose";
import { HsChoice, NormalizedSpec, type HsChoiceT, type NormalizedSpecT } from "./schema";
import { canonicalize } from "./units";

export function normalizePrompt(rawText: string): { system: string; human: string } {
  return {
    system: [
      "You normalise industrial purchase request lines from Saudi companies into a structured specification.",
      "Lines arrive in Arabic, English, or a mix, with abbreviations (VLV = valve, SS = stainless steel, CS = carbon steel, CI = cast iron, DI = ductile iron, FLGD = flanged, BW = butt weld, RF = raised face, CL150 = ANSI class 150, PN16 = 16 bar, DN50 = 2 inch).",
      "Arabic-Indic digits are ordinary digits. 'بوصة' means inch. 'بار' means bar. 'صمام كروي' is a ball valve, 'صمام بوابة' a gate valve, 'صمام فراشة' a butterfly valve, 'صمام عدم رجوع' or 'لا رجعي' a check valve, 'صمام أمان' a safety valve, 'مضخة طرد مركزي' a centrifugal pump, 'غطاس' a submersible pump, 'كوع' an elbow, 'شفة' or 'فلنجة' a flange.",
      "Fill only what the line states or what follows from it. Use null when unknown. Do not guess materials or ratings.",
      "Put flow, head, power, voltage, seat material, operator type, schedule and face type into extra_attrs.",
      "english_description is one clean English line a customs officer would understand.",
      "/no_think",
    ].join("\n"),
    human: `Purchase request line:\n${rawText}`,
  };
}

export function anchorPrompt(rawText: string, spec: NormalizedSpecT, candidates: HsHit[]): { system: string; human: string } {
  const list = candidates.map((c) => `${c.code}: ${c.title_en} | ${c.title_ar}`).join("\n");
  return {
    system: [
      "You are a customs classifier. Choose the single six-digit Harmonized System subheading that best fits the object.",
      "Choose only from the candidate list. Prefer the specific subheading over a residual 'other' one when the object matches it.",
      "Iron or steel pipe fittings are 7307; stainless flanges 730721; other steel flanges 730791; copper alloy fittings are 7412, not 7307; plastic fittings are 3917.",
      "Check valves are 848130, safety and relief valves 848140, pressure reducing valves 848110, other valves such as ball, gate, globe and butterfly valves 848180. Centrifugal pumps are 841370; dosing and other reciprocating positive displacement pumps 841350; rotary positive displacement pumps 841360.",
      "Return hs6, a confidence between 0 and 1, and one sentence of reasoning.",
      "/no_think",
    ].join("\n"),
    human: `Line: ${rawText}\nNormalised: ${spec.english_description}\n\nCandidates:\n${list}`,
  };
}

export async function normalizeNode(model: BaseChatModel, db: Sql, runId: string, rawText: string, handler: TrajectoryHandler): Promise<NormalizedSpecT> {
  const p = normalizePrompt(rawText);
  const spec = await invokeStructured(model, [new SystemMessage(p.system), new HumanMessage(p.human)], {
    name: "normalized_spec", description: "The normalised specification of one purchase request line",
    toolSchema: NormalizedSpec, parseSchema: NormalizedSpecLoose,
    config: { callbacks: [handler], runName: "normalize" },
    onRetry: (issues) => addStep(db, runId, { kind: "note", name: "normalize_retry", output: { issues } }),
  });
  return canonicalize(spec);
}

export async function retrieveCandidates(db: Sql, runId: string, spec: NormalizedSpecT): Promise<HsHit[]> {
  const t = Date.now();
  const r = await retrieveHsCandidates(db, { objectClass: spec.object_class, description: spec.english_description, family: spec.object_family });
  await addStep(db, runId, {
    kind: "retrieval", name: "hs_candidates",
    input: r.queries,
    output: { headings: r.headings.map((h) => `${h.code} ${h.via} ${h.title_en.slice(0, 60)}`), candidates: r.candidates.map((c) => c.code) },
    durationMs: Date.now() - t,
  });
  return r.candidates;
}

export async function anchorNode(model: BaseChatModel, db: Sql, runId: string, rawText: string, spec: NormalizedSpecT, candidates: HsHit[], handler: TrajectoryHandler): Promise<HsChoiceT> {
  const p = anchorPrompt(rawText, spec, candidates);
  const choice = await invokeStructured(model, [new SystemMessage(p.system), new HumanMessage(p.human)], {
    name: "hs_choice", description: "The chosen six-digit HS subheading with a confidence and one sentence of reasoning",
    toolSchema: HsChoice, parseSchema: HsChoiceLoose,
    config: { callbacks: [handler], runName: "anchor" },
    onRetry: (issues) => addStep(db, runId, { kind: "note", name: "anchor_retry", output: { issues } }),
  });
  if (!candidates.some((c) => c.code === choice.hs6)) {
    await addStep(db, runId, { kind: "note", name: "anchor_outside_candidates", input: choice, output: { fallback: candidates[0]?.code } });
    return { hs6: candidates[0]!.code, confidence: Math.min(choice.confidence, 0.3), reasoning: `model chose ${choice.hs6} outside the candidate list; fell back to the nearest neighbour` };
  }
  return choice;
}
