import { END, START, StateGraph, StateSchema } from "@langchain/langgraph";
import type { Sql } from "postgres";
import { z } from "zod";
import type { HsHit } from "../hs/search";
import { getChatModel, modelRefFor } from "../models/registry";
import { withRun, type TrajectoryHandler } from "../trajectory/handler";
import { anchorNode, normalizeNode, retrieveCandidates } from "./nodes";
import { NormalizedSpec, type NormalizedSpecT } from "./schema";

export type CoordinatorInput = { rawText: string; portco: string; sourceSystem?: string };
export type CoordinatorResult = { runId: string; demandLineId: string; normalized: NormalizedSpecT; candidates: HsHit[]; hs6: string; confidence: number; reasoning: string };

const State = new StateSchema({
  rawText: z.string(),
  normalized: NormalizedSpec.optional(),
  candidates: z.array(z.object({ code: z.string(), title_en: z.string(), title_ar: z.string(), distance: z.number() })).optional(),
  hs6: z.string().optional(),
  confidence: z.number().optional(),
  reasoning: z.string().optional(),
});

export function buildCoordinatorRun(db: Sql, runId: string, handler: TrajectoryHandler) {
  const model = getChatModel("coordinator");
  return new StateGraph(State)
    .addNode("normalize", async (s) => ({ normalized: await normalizeNode(model, db, runId, s.rawText, handler) }))
    .addNode("retrieve", async (s) => ({ candidates: await retrieveCandidates(db, runId, s.normalized!) }))
    .addNode("anchor", async (s) => {
      const c = await anchorNode(model, db, runId, s.rawText, s.normalized!, s.candidates!, handler);
      return { hs6: c.hs6, confidence: c.confidence, reasoning: c.reasoning };
    })
    .addEdge(START, "normalize")
    .addEdge("normalize", "retrieve")
    .addEdge("retrieve", "anchor")
    .addEdge("anchor", END)
    .compile();
}

export async function runCoordinator(db: Sql, input: CoordinatorInput): Promise<CoordinatorResult> {
  return withRun(db, { role: "coordinator", inputRef: input.rawText, model: modelRefFor("coordinator") }, async (runId, handler) => {
    const run = buildCoordinatorRun(db, runId, handler);
    const out = await run.invoke({ rawText: input.rawText });
    const normalized = out.normalized!;
    const [line] = await db<{ id: string }[]>`
      insert into demand_lines (raw_text, portco, source_system, language, normalized_spec, hs6, confidence, run_id)
      values (${input.rawText}, ${input.portco}, ${input.sourceSystem ?? null}, ${normalized.source_language}, ${db.json(normalized as never)}, ${out.hs6!}, ${out.confidence!}, ${runId})
      returning id`;
    return { runId, demandLineId: line!.id, normalized, candidates: out.candidates!, hs6: out.hs6!, confidence: out.confidence!, reasoning: out.reasoning! };
  });
}
