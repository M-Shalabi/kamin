import { beforeAll, describe, expect, test } from "bun:test";
import { RunnableLambda } from "@langchain/core/runnables";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { TrajectoryHandler, withRun } from "../src/trajectory/handler";
import { addStep, startRun } from "../src/trajectory/store";

describe.skipIf(!process.env.DATABASE_URL)("trajectory", () => {
  beforeAll(async () => { await migrate(sql); });

  test("withRun records a run, its manual steps and chain callbacks, then finishes it", async () => {
    const lines: string[] = [];
    const result = await withRun(sql, { role: "coordinator", inputRef: "test-line", model: "ollama:qwen3.5:9b" }, async (runId, handler) => {
      handler.sink = (s) => lines.push(s);
      await addStep(sql, runId, { kind: "note", name: "hello", output: { x: 1 } });
      const chain = RunnableLambda.from(async (input: { a: number }) => ({ b: input.a + 1 })).withConfig({ runName: "add_one" });
      return chain.invoke({ a: 1 }, { callbacks: [handler] });
    });
    expect(result).toEqual({ b: 2 });
    const [run] = await sql<{ status: string; role: string }[]>`select status, role from runs where input_ref = 'test-line' order by started_at desc limit 1`;
    expect(run).toEqual({ status: "ok", role: "coordinator" });
    const steps = await sql<{ kind: string; name: string }[]>`
      select s.kind, s.name from run_steps s join runs r on r.id = s.run_id where r.input_ref = 'test-line' and r.status = 'ok' order by r.started_at desc, s.seq`;
    expect(steps.map((s) => s.name)).toContain("hello");
    expect(steps.map((s) => s.name)).toContain("add_one");
    expect(lines.some((l) => l.includes("add_one"))).toBe(true);
  });

  test("withRun marks a failing run as error and rethrows", async () => {
    await expect(withRun(sql, { role: "coordinator", inputRef: "boom", model: "m" }, async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    const [run] = await sql<{ status: string; error: string }[]>`select status, error from runs where input_ref = 'boom' order by started_at desc limit 1`;
    expect(run).toEqual({ status: "error", error: "boom" });
  });

  test("TrajectoryHandler has the name LangChain requires", () => {
    expect(new TrajectoryHandler(sql, "00000000-0000-0000-0000-000000000000").name).toBe("kamin_trajectory");
  });

  test("concurrent addStep calls on one run get distinct sequence numbers", async () => {
    const runId = await startRun(sql, { role: "detective", inputRef: "test-concurrent", model: "m" });
    await Promise.all(Array.from({ length: 20 }, (_, i) => addStep(sql, runId, { kind: "note", name: `n${i}` })));
    const rows = await sql<{ n: number; d: number }[]>`select count(*)::int as n, count(distinct seq)::int as d from run_steps where run_id = ${runId}`;
    expect(rows[0]).toEqual({ n: 20, d: 20 });
  });

  test("withRun routes trajectory lines to a provided sink", async () => {
    const lines: string[] = [];
    await withRun(sql, { role: "coordinator", inputRef: "test-sink", model: "m" }, async (_runId, handler) => { handler.sink("hello sink"); return 1; }, { sink: (l) => lines.push(l) });
    expect(lines.some((l) => l.includes("hello sink"))).toBe(true);
    expect(lines.some((l) => l.startsWith("▶ run"))).toBe(true);
  });
});
