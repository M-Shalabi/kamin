import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";

describe.skipIf(!process.env.DATABASE_URL)("demand schema", () => {
  beforeAll(async () => { await migrate(sql); });
  test("imports, mandatory list, matches and gap cases exist with their keys", async () => {
    await sql`insert into imports (hs6, year, reporter, flow, partner, value_usd) values ('848180', 2024, 682, 'M', 0, 1865610792) on conflict do nothing`;
    await sql`insert into mandatory_list (hs4, label_en, effective_from, source_url) values ('8481', 'Valves', '2027-08-01', 'https://www.spa.gov.sa/en/N2514218') on conflict do nothing`;
    const [o] = await sql<{ id: string }[]>`insert into pooled_orders (hs6, spec_envelope, family, title, annual_value_usd, gap_kind) values ('848180', '{}'::jsonb, 'valve', 'test schema ball valve', 100000, 'supply_gap') returning id`;
    await sql`insert into gap_cases (pooled_order_id, "case") values (${o!.id}, '{"headline": "x"}'::jsonb)`;
    const [row] = await sql<{ n: number }[]>`select count(*)::int as n from gap_cases where pooled_order_id = ${o!.id}`;
    expect(row!.n).toBe(1);
    await expect((async () => { await sql`insert into pooled_orders (hs6, spec_envelope, gap_kind) values ('848180', '{}'::jsonb, 'nonsense')`; })()).rejects.toThrow();
    await sql`delete from pooled_orders where id = ${o!.id}`;
  });
});
