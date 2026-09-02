import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { hsEmbeddingText, lexicalTerms, retrieveHsCandidates, toVectorLiteral } from "../src/hs/search";
import { ollamaUp } from "../src/models/registry";

describe("hs search helpers", () => {
  test("toVectorLiteral formats for pgvector", () => {
    expect(toVectorLiteral([0.5, -1, 2])).toBe("[0.5,-1,2]");
  });
  test("hsEmbeddingText joins english, arabic and the parent heading", () => {
    expect(hsEmbeddingText({ title_en: "Check valves", title_ar: "صمامات عدم رجوع", parentTitleEn: "Taps, cocks, valves" }))
      .toBe("Check valves. صمامات عدم رجوع. Category: Taps, cocks, valves");
  });
  test("lexicalTerms keeps object words and drops numbers, units and stopwords", () => {
    expect(lexicalTerms("brass hexagon nipple pipe fitting 1/2 inch NPT")).toEqual(["brass", "hexagon", "nipple", "pipe", "fitting", "npt"]);
    expect(lexicalTerms("2 inch stainless steel ball valve rated 40 bar")).toEqual(["stainless", "steel", "ball", "valve", "rated"]);
  });
});

describe.skipIf(!process.env.DATABASE_URL || !(await ollamaUp()))("two-stage hs retrieval", () => {
  beforeAll(async () => {
    const [row] = await sql<{ n6: number; n4: number }[]>`
      select count(*) filter (where level = 6 and embedding is not null)::int as n6,
             count(*) filter (where level = 4 and embedding is not null)::int as n4 from hs_codes`;
    if (row!.n6 < 9000 || row!.n4 < 1400) throw new Error(`hs_codes not fully embedded (${row!.n6} subheadings, ${row!.n4} headings); run bun run embed:hs first`);
  });

  const cases: [string, string, string, string][] = [
    ["ball valve", "2 inch stainless steel 316 ball valve, ANSI Class 150, flanged connection", "valve", "848180"],
    ["gate valve", "cast iron gate valve DN100 PN16 flanged", "valve", "848180"],
    ["centrifugal pump", "horizontal centrifugal pump 50 m3/h 40 m head 15 kW", "pump", "841370"],
    ["blind flange", "carbon steel blind flange 4 inch class 150 raised face ASTM A105", "flange", "730791"],
    ["hex nipple", "brass hexagon nipple pipe fitting 1/2 inch NPT", "fitting", "741220"],
    ["butt weld elbow", "90 degree long radius butt weld elbow 2 inch SCH40 stainless steel 316L ASTM A403", "fitting", "730723"],
  ];
  for (const [objectClass, description, family, expected] of cases) {
    test(`candidates for "${objectClass}" include ${expected}`, async () => {
      const r = await retrieveHsCandidates(sql, { objectClass, description, family });
      expect(r.candidates.map((c) => c.code)).toContain(expected);
      expect(r.candidates.length).toBeLessThanOrEqual(60);
    }, 60_000);
  }
  test("a family with no seeds still returns candidates", async () => {
    const r = await retrieveHsCandidates(sql, { objectClass: "yogurt", description: "packaged natural yogurt 1 kg", family: "other" });
    expect(r.candidates.map((c) => c.code.slice(0, 4))).toContain("0403");
  }, 60_000);
});
