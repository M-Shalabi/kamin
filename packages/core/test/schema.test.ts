import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";

describe.skipIf(!process.env.DATABASE_URL)("graph schema", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from suppliers where id like 'test:%'`;
  });

  test("a supplier can hold a capability with a class, a verdict and evidence", async () => {
    await sql`insert into suppliers (id, name_ar, name_en, cr_number, source) values ('test:1', 'مصنع اختبار', 'Test Plant', '1010000000', 'test')`;
    await sql`insert into products (tariff_code, hs6, title_ar, title_en, source) values ('848180000000', '848180', 'صمامات', 'Valves', 'test') on conflict do nothing`;
    const [cap] = await sql<{ id: string }[]>`
      insert into capabilities (supplier_id, tariff_code, hs6, class, verdict, declared_amount, declared_unit)
      values ('test:1', '848180000000', '848180', 'manufacturer', 'pending', 150, 'Ton') returning id`;
    await sql`insert into evidence (capability_id, tier, source_type, source_url, excerpt) values (${cap!.id}, 2, 'test', 'https://example.test', 'excerpt')`;
    const [row] = await sql<{ n: number }[]>`select count(*)::int as n from evidence where capability_id = ${cap!.id}`;
    expect(row!.n).toBe(1);
  });

  test("an invalid class is rejected", async () => {
    await expect((async () => {
      await sql`insert into capabilities (supplier_id, tariff_code, hs6, class, verdict) values ('test:1', '848180000000', '848180', 'factory', 'pending')`;
    })()).rejects.toThrow();
  });

  test("an invalid evidence tier is rejected", async () => {
    const [cap] = await sql<{ id: string }[]>`select id from capabilities where supplier_id = 'test:1' limit 1`;
    await expect((async () => {
      await sql`insert into evidence (capability_id, tier, source_type, source_url, excerpt) values (${cap!.id}, 5, 'test', 'https://example.test', 'x')`;
    })()).rejects.toThrow();
  });
});
