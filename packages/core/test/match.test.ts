import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { isSupported, scoreCapability, specCompatible, splitShares, type CapabilityCandidate } from "../src/match/score";
import { matchOrder } from "../src/match/persist";
import { coverage } from "../src/match/coverage";

const env = { object_class: "ball valve", object_family: "valve", size_inch: 2, size_dn: 50, pressure_bar: 40, pressure_class: null, material: "stainless_steel", material_grade: "316", connection: null };
const cap = (over: Partial<CapabilityCandidate>): CapabilityCandidate => ({ id: "c", supplier_id: "s", hs6: "848180", class: "manufacturer", verdict: "supported", confidence: 0.8, best_tier: 2, spec_attrs: {}, declared_amount: null, declared_unit: null, region_en: null, in_made_in_saudi: false, ...over });

describe("scoring", () => {
  test("specCompatible reads stated attributes against the envelope", () => {
    expect(specCompatible(env, { material: "stainless steel 316", size: "1/2 to 4 inch" }).ok).toBe(true);
    expect(specCompatible(env, { material: "cast iron" }).conflicts).toContain("material");
    expect(specCompatible(env, {}).ok).toBe(true);
  });
  test("class, verdict and tier weights order candidates as the glossary says", () => {
    const maker = scoreCapability({ hs6: "848180", envelope: env }, cap({})).score;
    const trader = scoreCapability({ hs6: "848180", envelope: env }, cap({ class: "trader" })).score;
    const pending = scoreCapability({ hs6: "848180", envelope: env }, cap({ verdict: "pending" })).score;
    const refuted = scoreCapability({ hs6: "848180", envelope: env }, cap({ verdict: "refuted" })).score;
    const tier1 = scoreCapability({ hs6: "848180", envelope: env }, cap({ best_tier: 1 })).score;
    expect(maker).toBeGreaterThan(trader);
    expect(maker).toBeGreaterThan(pending);
    expect(refuted).toBe(0);
    expect(tier1).toBeGreaterThan(maker);
  });
  test("isSupported requires a supported verdict and tier 1 or 2 evidence", () => {
    expect(isSupported(cap({}))).toBe(true);
    expect(isSupported(cap({ best_tier: 3 }))).toBe(false);
    expect(isSupported(cap({ verdict: "pending" }))).toBe(false);
  });
  test("splitShares allocates by declared capacity when units are comparable, else equally over the top three", () => {
    expect(splitShares({ qty_annual: 1000 }, [cap({ declared_amount: 600, declared_unit: "Piece" }), cap({ declared_amount: 400, declared_unit: "Piece" })])).toEqual([0.6, 0.4]);
    expect(splitShares({ qty_annual: 1000 }, [cap({}), cap({}), cap({}), cap({})])).toEqual([1 / 3, 1 / 3, 1 / 3, 0]);
  });
});

describe.skipIf(!process.env.DATABASE_URL)("what closes a gap", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from suppliers where id like 'test:mg%'`;
    await sql`delete from pooled_orders where title like 'test match gap%'`;
    await sql`insert into suppliers (id, name_en, source) values ('test:mg1', 'Sibling maker', 'test'), ('test:mg2', 'Conflicting maker', 'test'), ('test:mg3', 'Exact maker', 'test')`;
    await sql`insert into capabilities (supplier_id, hs6, product_title, class, verdict, confidence, origin, spec_attrs) values
      ('test:mg1', '848130', 'check valves', 'manufacturer', 'supported', 0.9, 'detective', '{}'),
      ('test:mg2', '848180', 'cast iron ball valves', 'manufacturer', 'supported', 0.9, 'detective', '{"material": "cast iron"}'),
      ('test:mg3', '848180', 'ball valves', 'manufacturer', 'supported', 0.9, 'detective', '{}')`;
    const caps = await sql<{ id: string }[]>`select id from capabilities where supplier_id like 'test:mg%'`;
    for (const c of caps) await sql`insert into evidence (capability_id, tier, source_type, source_url, excerpt) values (${c.id}, 2, 'test', 'https://x', 'x')`;
  });
  test("a supported maker at a sibling subheading or with a conflicting attribute is listed but does not cover", async () => {
    const [o] = await sql<{ id: string }[]>`insert into pooled_orders (hs6, spec_envelope, family, title, annual_value_usd) values ('848180', ${sql.json(env as never)}, 'valve', 'test match gap valve', 100) returning id`;
    const sibling = await matchOrder(sql, o!.id, { onlySupplierIds: ["test:mg1"] });
    expect(sibling.matches).toBe(1);
    expect(sibling.gap_kind).toBe("supply_gap");
    const conflicting = await matchOrder(sql, o!.id, { onlySupplierIds: ["test:mg2"] });
    expect(conflicting.gap_kind).toBe("supply_gap");
    const exact = await matchOrder(sql, o!.id, { onlySupplierIds: ["test:mg3"] });
    expect(exact.gap_kind).toBe("covered");
    await sql`delete from pooled_orders where id = ${o!.id}`;
    await sql`delete from suppliers where id like 'test:mg%'`;
  });
});

describe.skipIf(!process.env.DATABASE_URL)("matchOrder and coverage", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from suppliers where id like 'test:mt%'`;
    await sql`delete from pooled_orders where title like 'test match%'`;
    await sql`insert into suppliers (id, name_en, source, region_en) values ('test:mt1', 'Maker', 'test', 'Eastern Region'), ('test:mt2', 'Trader', 'test', 'Riyadh Region')`;
    await sql`insert into capabilities (supplier_id, hs6, product_title, class, verdict, confidence, origin) values ('test:mt1', '848180', 'ball valves', 'manufacturer', 'supported', 0.8, 'detective'), ('test:mt2', '848180', 'ball valves', 'trader', 'supported', 0.7, 'detective'), ('test:mt2', '841370', 'pumps', 'trader', 'refuted', 0.1, 'detective')`;
    const caps = await sql<{ id: string; supplier_id: string; hs6: string }[]>`select id, supplier_id, hs6 from capabilities where supplier_id like 'test:mt%'`;
    for (const c of caps) await sql`insert into evidence (capability_id, tier, source_type, source_url, excerpt) values (${c.id}, ${c.supplier_id === 'test:mt1' ? 2 : 3}, 'test', 'https://x', 'x')`;
  });
  test("ranks the maker first and computes coverage over the test orders", async () => {
    const [o1] = await sql<{ id: string }[]>`insert into pooled_orders (hs6, spec_envelope, family, title, annual_value_usd) values ('848180', ${sql.json(env as never)}, 'valve', 'test match valve', 700) returning id`;
    const [o2] = await sql<{ id: string }[]>`insert into pooled_orders (hs6, spec_envelope, family, title, annual_value_usd) values ('841370', ${sql.json({ ...env, object_class: "centrifugal pump", object_family: "pump" } as never)}, 'pump', 'test match pump', 300) returning id`;
    const r = await matchOrder(sql, o1!.id, { onlySupplierIds: ["test:mt1", "test:mt2"] });
    expect(r.matches).toBe(2);
    const rows = await sql<{ supplier_id: string; rank: number }[]>`select c.supplier_id, m.rank from matches m join capabilities c on c.id = m.capability_id where m.pooled_order_id = ${o1!.id} order by m.rank`;
    expect(rows.map((x) => x.supplier_id)).toEqual(["test:mt1", "test:mt2"]);
    await matchOrder(sql, o2!.id, { onlySupplierIds: ["test:mt1", "test:mt2"] });
    const c = await coverage(sql, { onlyOrderIds: [o1!.id, o2!.id] });
    expect(c.spend_total).toBe(1000);
    expect(c.spend_covered).toBe(700);
    expect(c.coverage).toBeCloseTo(0.7, 5);
    expect(c.line_coverage).toBeCloseTo(0.5, 5);
    expect(c.supply_gaps).toBe(1);
  });
});
