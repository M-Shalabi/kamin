import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { anchorPrompt, normalizePrompt } from "../src/coordinator/nodes";
import { runCoordinator } from "../src/coordinator/run";
import { ollamaUp } from "../src/models/registry";

describe("prompts", () => {
  test("normalizePrompt carries the raw line and the no-think switch", () => {
    const p = normalizePrompt("BALL VLV 2IN SS");
    expect(p.system).toContain("/no_think");
    expect(p.human).toContain("BALL VLV 2IN SS");
  });
  test("anchorPrompt lists every candidate code with both titles", () => {
    const p = anchorPrompt("x", { english_description: "ball valve" } as never, [
      { code: "848180", title_en: "Other appliances", title_ar: "غير ذلك", distance: 0.1 },
      { code: "848130", title_en: "Check valves", title_ar: "صمامات عدم رجوع", distance: 0.2 },
    ]);
    expect(p.human).toContain("848180");
    expect(p.human).toContain("صمامات عدم رجوع");
  });
});

describe.skipIf(!process.env.DATABASE_URL || !(await ollamaUp()))("runCoordinator on the local model", () => {
  beforeAll(async () => {
    const [row] = await sql<{ n: number }[]>`select count(*)::int as n from hs_codes where embedding is not null`;
    if (row!.n < 9000) throw new Error("run bun run embed:hs first");
  });

  test("resolves an arabic ball valve line to a valve heading with a persisted run", async () => {
    const r = await runCoordinator(sql, { rawText: "صمام كروي من الفولاذ المقاوم للصدأ ٢ بوصة، ضغط ٤٠ بار", portco: "Ma'aden" });
    expect(r.hs6.slice(0, 4)).toBe("8481");
    expect(r.normalized.object_family).toBe("valve");
    expect(r.normalized.size_inch).toBe(2);
    expect(r.normalized.material).toBe("stainless_steel");
    expect(r.candidates.map((c) => c.code)).toContain(r.hs6);
    const steps = await sql<{ kind: string }[]>`select kind from run_steps where run_id = ${r.runId}`;
    expect(steps.filter((s) => s.kind === "llm_call").length).toBeGreaterThanOrEqual(2);
    expect(steps.some((s) => s.kind === "retrieval")).toBe(true);
    const [line] = await sql<{ hs6: string }[]>`select hs6 from demand_lines where id = ${r.demandLineId}`;
    expect(line!.hs6).toBe(r.hs6);
  }, 240_000);
});
