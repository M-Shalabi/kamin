import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { Serialized } from "@langchain/core/load/serializable";
import type { BaseMessage } from "@langchain/core/messages";
import type { LLMResult } from "@langchain/core/outputs";
import type { ChainValues } from "@langchain/core/utils/types";
import type { Sql } from "postgres";
import { addStep, finishRun, startRun, type RunMeta, type StepInput } from "./store";

const compact = (v: unknown, max = 600): string => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s === undefined ? "" : s.length > max ? s.slice(0, max) + "…" : s;
};

export class TrajectoryHandler extends BaseCallbackHandler {
  name = "kamin_trajectory";
  sink: (line: string) => void = (l) => console.log(l);
  private starts = new Map<string, { name: string; input: unknown; t: number }>();
  private queue: Promise<void> = Promise.resolve();

  constructor(private db: Sql, private runId: string, private opts: { print?: boolean } = { print: true }) {
    super();
  }

  private record(step: StepInput) {
    if (this.opts.print !== false) {
      const took = step.durationMs !== undefined ? ` ${(step.durationMs / 1000).toFixed(1)}s` : "";
      const tok = step.tokensIn !== undefined ? ` ${step.tokensIn}→${step.tokensOut ?? 0} tok` : "";
      this.sink(`[${step.kind}] ${step.name}${took}${tok}${step.output !== undefined ? ` → ${compact(step.output, 300)}` : ""}`);
    }
    this.queue = this.queue.then(() => addStep(this.db, this.runId, step)).catch((e) => console.error("trajectory write failed", e));
  }

  flush(): Promise<void> { return this.queue; }

  private open(runId: string, name: string, input: unknown) { this.starts.set(runId, { name, input, t: Date.now() }); }
  private close(runId: string, kind: StepInput["kind"], output: unknown, extra: Partial<StepInput> = {}) {
    const s = this.starts.get(runId); this.starts.delete(runId);
    this.record({ kind, name: s?.name ?? "unknown", input: s?.input, output, durationMs: s ? Date.now() - s.t : undefined, ...extra });
  }

  override handleChatModelStart(_llm: Serialized, messages: BaseMessage[][], runId: string, _parentRunId?: string, _extraParams?: Record<string, unknown>, _tags?: string[], _metadata?: Record<string, unknown>, runName?: string) {
    this.open(runId, runName ?? "llm", messages.flat().map((m) => ({ role: m._getType(), content: compact(m.content, 2000) })));
  }
  override handleLLMStart(_llm: Serialized, prompts: string[], runId: string, _parentRunId?: string, _extraParams?: Record<string, unknown>, _tags?: string[], _metadata?: Record<string, unknown>, runName?: string) {
    this.open(runId, runName ?? "llm", prompts);
  }
  override handleLLMEnd(output: LLMResult, runId: string) {
    const gen = output.generations[0]?.[0] as { text?: string; message?: { usage_metadata?: { input_tokens?: number; output_tokens?: number }; tool_calls?: { name: string; args: unknown }[] } } | undefined;
    const usage = gen?.message?.usage_metadata;
    const text = gen?.text ?? "";
    const calls = gen?.message?.tool_calls ?? [];
    const result = text.length ? text : calls.length ? { tool_calls: calls.map((c) => ({ name: c.name, args: c.args })) } : null;
    this.close(runId, "llm_call", result, { tokensIn: usage?.input_tokens, tokensOut: usage?.output_tokens });
  }
  override handleLLMError(err: Error, runId: string) { this.close(runId, "error", err.message); }
  override handleChainStart(_chain: Serialized, inputs: ChainValues, runId: string, _parentRunId?: string, _tags?: string[], _metadata?: Record<string, unknown>, _runType?: string, runName?: string) {
    this.open(runId, runName ?? "chain", inputs);
  }
  override handleChainEnd(outputs: ChainValues, runId: string) { this.close(runId, "note", outputs); }
  override handleChainError(err: Error, runId: string) { this.close(runId, "error", err.message); }
  override handleToolStart(_tool: Serialized, input: string, runId: string, _parentRunId?: string, _tags?: string[], _metadata?: Record<string, unknown>, runName?: string) {
    this.open(runId, runName ?? "tool", input);
  }
  override handleToolEnd(output: unknown, runId: string) { this.close(runId, "tool_call", output); }
  override handleToolError(err: Error, runId: string) { this.close(runId, "error", err.message); }
}

export async function withRun<T>(db: Sql, meta: RunMeta, fn: (runId: string, handler: TrajectoryHandler) => Promise<T>, opts: { sink?: (line: string) => void } = {}): Promise<T> {
  const runId = await startRun(db, meta);
  const handler = new TrajectoryHandler(db, runId);
  if (opts.sink) handler.sink = opts.sink;
  handler.sink(`▶ run ${runId} ${meta.role} on ${meta.model}: ${meta.inputRef}`);
  try {
    const out = await fn(runId, handler);
    await handler.flush();
    await finishRun(db, runId, "ok");
    handler.sink(`■ run ${runId} ok`);
    return out;
  } catch (err) {
    await handler.flush();
    await finishRun(db, runId, "error", (err as Error).message);
    handler.sink(`■ run ${runId} error: ${(err as Error).message}`);
    throw err;
  }
}
