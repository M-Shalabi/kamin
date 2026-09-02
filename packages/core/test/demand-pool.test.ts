import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { poolAndPersist } from "../src/demand/pool";

const spec = (over: Record<string, unknown>) => sql.json({ object_class: "ball valve", object_family: "valve", size_inch: 2, size_dn: 50, pressure_bar: 40, pressure_class: null, material: "stainless_steel", material_grade: null, connection: null, standard: null, quantity: null, quantity_unit: null, extra_attrs: [], english_description: "2 inch ss ball valve", source_language: "en", ...over } as never);

describe.skipIf(!process.env.DATABASE_URL)("poolAndPersist", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from demand_lines where line_key like 'test:pool:%'`;
    await sql`insert into demand_lines (raw_text, portco, hs6, normalized_spec, qty, history_factor, annual_value_usd, line_key, seed_hs6) values
      ('a', 'Ma''aden', '848180', ${spec({})}, 12, 10, 1000, 'test:pool:1', '848180'),
      ('b', 'ACWA Power', '848180', ${spec({ material_grade: "316" })}, 40, 5, 2000, 'test:pool:2', '848180'),
      ('c', 'SEC', '848180', ${spec({ object_class: "gate valve" })}, 5, 1, 300, 'test:pool:3', '848180'),
      ('d', 'NEOM', null, null, 1, 1, 10, 'test:pool:4', '848180')`;
  });
  afterAll(async () => {
    const ids = await sql<{ id: string }[]>`select distinct pooled_order_id as id from demand_lines where line_key like 'test:pool:%' and pooled_order_id is not null`;
    await sql`delete from demand_lines where line_key like 'test:pool:%'`;
    if (ids.length) await sql`delete from pooled_orders where id in ${sql(ids.map((r) => r.id))}`;
  });
  test("pools compatible resolved lines into orders with quantities and values, leaving unresolved lines alone", async () => {
    const r = await poolAndPersist(sql, { lineKeyPrefix: "test:pool:" });
    expect(r.lines).toBe(3);
    const orders = await sql<{ hs6: string; qty_now: number; qty_annual: number; annual_value_usd: number; portco_count: number; title: string }[]>`
      select o.hs6, o.qty_now::float as qty_now, o.qty_annual::float as qty_annual, o.annual_value_usd::float as annual_value_usd, o.portco_count, o.title
      from pooled_orders o where o.id in (select pooled_order_id from demand_lines where line_key like 'test:pool:%') order by qty_now desc`;
    expect(orders.length).toBe(2);
    expect(orders[0]).toMatchObject({ hs6: "848180", qty_now: 52, qty_annual: 320, annual_value_usd: 3000, portco_count: 2 });
    expect(orders[0]!.title).toContain("ball valve");
    const [unresolved] = await sql<{ pooled_order_id: string | null }[]>`select pooled_order_id from demand_lines where line_key = 'test:pool:4'`;
    expect(unresolved!.pooled_order_id).toBeNull();
  });
});
