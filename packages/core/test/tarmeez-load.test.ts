import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { mapPlant } from "../src/tarmeez/map";
import { loadPlant, loadProductList } from "../src/tarmeez/load";
import plant from "./fixtures/tarmeez-plant-41699.json";
import type { PlantDetail } from "../src/tarmeez/client";

describe.skipIf(!process.env.DATABASE_URL)("tarmeez load", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from suppliers where id = 'tarmeez:41699'`;
  });

  test("loadPlant upserts supplier, product, capability and evidence, idempotently", async () => {
    const mapped = mapPlant(plant as PlantDetail);
    await loadPlant(sql, mapped);
    await loadPlant(sql, mapped);
    const [s] = await sql<{ cr_number: string }[]>`select cr_number from suppliers where id = 'tarmeez:41699'`;
    expect(s!.cr_number).toBe("2055024776");
    const [c] = await sql<{ n: number }[]>`select count(*)::int as n from capabilities where supplier_id = 'tarmeez:41699'`;
    expect(c!.n).toBe(1);
    const [e] = await sql<{ n: number }[]>`select count(*)::int as n from evidence e join capabilities c on c.id = e.capability_id where c.supplier_id = 'tarmeez:41699'`;
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
