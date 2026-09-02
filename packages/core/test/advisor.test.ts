import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { InvestmentCaseLoose } from "../src/advisor/schema";
import { adjacentSuppliers, advisorPrompt, runAdvisor } from "../src/advisor/run";
import { ollamaUp } from "../src/models/registry";

const env = { object_class: "ball valve", object_family: "valve", size_inch: 2, size_dn: 50, pressure_bar: 40, pressure_class: null, material: "stainless_steel", material_grade: null, connection: null };

describe("InvestmentCaseLoose", () => {
  test("coerces a sloppy case", () => {
    const c = InvestmentCaseLoose.parse({ headline: "h", annual_value_usd: "1,200,000", pivot_candidates: [{ supplier_id: "tarmeez:1", supplier_name: "X", why: "w" }], raw_materials: null });
    expect(c.annual_value_usd).toBe(1200000);
    expect(c.pivot_candidates[0]!.what_is_missing).toBe("");
    expect(c.raw_materials).toBe("");
  });
});

describe.skipIf(!process.env.DATABASE_URL)("adjacency", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from suppliers where id like 'test:adj%'`;
    await sql`insert into suppliers (id, name_en, source, region_en) values ('test:adj1', 'Fittings Plant', 'test', 'Eastern Region'), ('test:adj2', 'Valve Trader', 'test', 'Riyadh Region')`;
    await sql`insert into capabilities (supplier_id, hs6, product_title, class, verdict, confidence, origin) values ('test:adj1', '730793', 'butt weld fittings', 'manufacturer', 'supported', 0.8, 'detective'), ('test:adj2', '848180', 'ball valves', 'trader', 'supported', 0.7, 'detective')`;
    const caps = await sql<{ id: string }[]>`select id from capabilities where supplier_id like 'test:adj%'`;
    for (const c of caps) await sql`insert into evidence (capability_id, tier, source_type, source_url, excerpt) values (${c.id}, 2, 'test', 'https://x', 'x')`;
  });
  test("a fittings manufacturer is adjacent to a valve gap, ahead of a valve trader", async () => {
    const adj = await adjacentSuppliers(sql, { hs6: "848180", spec_envelope: env }, { onlySupplierIds: ["test:adj1", "test:adj2"] });
    const ids = adj.map((a) => a.supplier_id);
    expect(ids.indexOf("test:adj1")).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf("test:adj1")).toBeLessThan(ids.indexOf("test:adj2"));
    expect(adj[0]!.relation).toBeDefined();
  });
  test("advisorPrompt carries the value, the mandatory flag, the candidates and the no-think switch", () => {
    const p = advisorPrompt({ id: "o", hs6: "848180", title: "stainless ball valve 2 inch", family: "valve", annual_value_usd: 1500000, qty_annual: 4000, portco_count: 3, mandatory: true, spec_envelope: env }, [{ supplier_id: "test:adj1", name: "Fittings Plant", hs6: "730793", product: "butt weld fittings", class: "manufacturer", relation: "makes steel fittings under a related heading", region: "Eastern Region" }], [{ name_en: "Ma'aden", website: null }], { value_usd: 1865610792 });
    expect(p.system).toContain("/no_think");
    expect(p.human).toContain("1,500,000");
    expect(p.human).toContain("Mandatory List");
    expect(p.human).toContain("Fittings Plant");
  });
});

describe.skipIf(!process.env.DATABASE_URL || !(await ollamaUp()))("runAdvisor live", () => {
  test("writes an investment case for a manufacturing gap", async () => {
    await sql`delete from pooled_orders where title = 'test advisor valve'`;
    const [o] = await sql<{ id: string }[]>`insert into pooled_orders (hs6, spec_envelope, family, title, annual_value_usd, qty_annual, portco_count, gap_kind, mandatory) values ('848180', ${sql.json(env as never)}, 'valve', 'test advisor valve', 1500000, 4000, 3, 'manufacturing_gap', true) returning id`;
    const r = await runAdvisor(sql, o!.id, { onlySupplierIds: ["test:adj1", "test:adj2"] });
    expect(r.case.headline.length).toBeGreaterThan(5);
    const [row] = await sql<{ n: number }[]>`select count(*)::int as n from gap_cases where pooled_order_id = ${o!.id}`;
    expect(row!.n).toBe(1);
  }, 300_000);
});
