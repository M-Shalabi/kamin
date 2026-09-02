import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";

describe.skipIf(!process.env.DATABASE_URL)("enrichment schema", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from suppliers where id like 'test:%'`;
    await sql`insert into suppliers (id, name_ar, name_en, source) values ('test:m2', 'مورد', 'Supplier', 'test')`;
  });

  test("a found capability needs no tariff code and is unique per supplier, hs6 and title", async () => {
    await sql`insert into capabilities (supplier_id, hs6, product_title, class, origin) values ('test:m2', '848180', 'Ball valves', 'trader', 'detective')`;
    await expect((async () => {
      await sql`insert into capabilities (supplier_id, hs6, product_title, class, origin) values ('test:m2', '848180', 'ball valves', 'trader', 'detective')`;
    })()).rejects.toThrow();
    const [row] = await sql<{ detective_status: string }[]>`select detective_status from suppliers where id = 'test:m2'`;
    expect(row!.detective_status).toBe("pending");
  });

  test("evidence can carry the run that produced it", async () => {
    const [cap] = await sql<{ id: string }[]>`select id from capabilities where supplier_id = 'test:m2' limit 1`;
    const [run] = await sql<{ id: string }[]>`insert into runs (role, input_ref, model) values ('detective', 'test:m2', 'm') returning id`;
    await sql`insert into evidence (capability_id, tier, source_type, source_url, excerpt, run_id, title) values (${cap!.id}, 3, 'website', 'https://example.test', 'x', ${run!.id}, 'Example')`;
    const [e] = await sql<{ n: number }[]>`select count(*)::int as n from evidence where run_id = ${run!.id}`;
    expect(e!.n).toBe(1);
  });
});
