import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { mapPlant } from "../src/tarmeez/map";
import { loadPlant, loadProductList } from "../src/tarmeez/load";
import plant from "./fixtures/tarmeez-plant-41699.json";
import type { PlantDetail } from "../src/tarmeez/client";

const TEST_ID = "test:plant-41699";

describe.skipIf(!process.env.DATABASE_URL)("tarmeez load", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from suppliers where id = ${TEST_ID}`;
  });
  afterAll(async () => { await sql`delete from suppliers where id = ${TEST_ID}`; });

  test("loadPlant upserts supplier, product, capability and evidence, idempotently", async () => {
    const real = mapPlant(plant as PlantDetail);
    // Never touch the real Kanoo plant row: the swarm's evidence and verdicts live on it.
    const mapped = { ...real, supplier: { ...real.supplier, id: TEST_ID, tarmeez_id: 99041699 }, capabilities: real.capabilities.map((c) => ({ ...c, supplier_id: TEST_ID })), evidence: real.evidence.map((e) => ({ ...e, supplier_id: TEST_ID })) };
    await loadPlant(sql, mapped);
    await loadPlant(sql, mapped);
    const [s] = await sql<{ cr_number: string }[]>`select cr_number from suppliers where id = ${TEST_ID}`;
    expect(s!.cr_number).toBe("2055024776");
    const [c] = await sql<{ n: number }[]>`select count(*)::int as n from capabilities where supplier_id = ${TEST_ID}`;
    expect(c!.n).toBe(1);
    const [e] = await sql<{ n: number }[]>`select count(*)::int as n from evidence e join capabilities c on c.id = e.capability_id where c.supplier_id = ${TEST_ID}`;
    expect(e!.n).toBe(1);
  });

  test("loadProductList upserts by tariff code and keeps the first title", async () => {
    await sql`delete from products where tariff_code = '8481300005' and not exists (select 1 from capabilities where tariff_code = '8481300005')`;
    const n = await loadProductList(sql, [
      { Id: 19961, Title: { Ar: "صمامات لارجعية", En: "NON-RETURN VALVES" }, Symbol: { Ar: "8481300005", En: "8481300005" } },
      { Id: 19999, Title: { Ar: "x", En: "y" }, Symbol: { Ar: "8481300005", En: "8481300005" } },
    ]);
    expect(n).toBe(1);
    const [p] = await sql<{ title_en: string; hs6: string }[]>`select title_en, hs6 from products where tariff_code = '8481300005'`;
    expect(p).toEqual({ title_en: "NON-RETURN VALVES", hs6: "848130" });
  });
});
