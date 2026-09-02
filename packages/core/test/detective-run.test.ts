import { describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { detectivePrompt, runDetective } from "../src/detective/run";
import { ollamaUp } from "../src/models/registry";

describe("detectivePrompt", () => {
  test("carries the declared products, the pages and the no-think switch", () => {
    const p = detectivePrompt({ id: "x", name_ar: "أ", name_en: "A", city_en: "Dammam", region_en: null, website: null, cr_number: "1", declared: [{ hs6: "848180", title_en: "Valves", title_ar: "صمامات", amount: 10, unit: "Ton" }] }, [{ url: "https://a.example", title: "A", snippet: "s", text: "long text", kind: "own_site", tier: 3, score: 1 }]);
    expect(p.system).toContain("/no_think");
    expect(p.human).toContain("848180");
    expect(p.human).toContain("https://a.example");
  });
});

describe.skipIf(!process.env.DATABASE_URL || !process.env.TAVILY_API_KEY || !(await ollamaUp()))("runDetective live", () => {
  test("investigates the Kanoo valves plant and persists evidence with a run", async () => {
    const r = await runDetective(sql, "tarmeez:41699");
    expect(r.findings.is_same_company).toBe(true);
    expect(r.merged.evidence).toBeGreaterThan(0);
    const steps = await sql<{ kind: string; name: string }[]>`select kind, name from run_steps where run_id = ${r.runId} order by seq`;
    expect(steps.filter((s) => s.kind === "retrieval").length).toBeGreaterThanOrEqual(2);
    expect(steps.some((s) => s.kind === "llm_call")).toBe(true);
    const [s] = await sql<{ detective_status: string }[]>`select detective_status from suppliers where id = 'tarmeez:41699'`;
    expect(s!.detective_status).toBe("ok");
  }, 400_000);
});
