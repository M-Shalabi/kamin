import type { Sql } from "postgres";

export type StepKind = "llm_call" | "tool_call" | "retrieval" | "note" | "error";
export type StepInput = { kind: StepKind; name: string; input?: unknown; output?: unknown; durationMs?: number; tokensIn?: number; tokensOut?: number };
export type RunMeta = { role: "coordinator" | "detective" | "auditor" | "advisor"; inputRef: string; model: string };

export async function startRun(db: Sql, meta: RunMeta): Promise<string> {
  const [row] = await db<{ id: string }[]>`insert into runs (role, input_ref, model) values (${meta.role}, ${meta.inputRef}, ${meta.model}) returning id`;
  return row!.id;
}

export async function addStep(db: Sql, runId: string, step: StepInput): Promise<void> {
  // Sequence numbers are computed from the current maximum; concurrent writers on one run can collide, so retry on the unique violation.
  for (let attempt = 0; ; attempt++) {
    try {
      await db`
        insert into run_steps (run_id, seq, kind, name, input, output, duration_ms, tokens_in, tokens_out)
        values (${runId}, (select coalesce(max(seq), 0) + 1 from run_steps where run_id = ${runId}), ${step.kind}, ${step.name},
                ${step.input === undefined ? null : db.json(step.input as never)}, ${step.output === undefined ? null : db.json(step.output as never)},
                ${step.durationMs ?? null}, ${step.tokensIn ?? null}, ${step.tokensOut ?? null})`;
      return;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "23505" || attempt >= 25) throw err;
      await new Promise((r) => setTimeout(r, 5 + Math.random() * 20));
    }
  }
}

export async function finishRun(db: Sql, runId: string, status: "ok" | "error", error?: string): Promise<void> {
  await db`update runs set status = ${status}, error = ${error ?? null}, finished_at = now() where id = ${runId}`;
}
