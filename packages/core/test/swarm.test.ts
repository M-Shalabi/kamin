import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { selectAuditTargets, selectSwarmSuppliers } from "../scripts/swarm";

describe.skipIf(!process.env.DATABASE_URL)("swarm selection", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from suppliers where id like 'test:sw%'`;
    await sql`insert into products (tariff_code, hs6, title_ar, title_en, source) values ('848180000000', '848180', 'صمامات', 'Valves', 'test'), ('841370000000', '841370', 'مضخات', 'Pumps', 'test'), ('040310000000', '040310', 'زبادي', 'Yogurt', 'test') on conflict do nothing`;
    await sql`insert into suppliers (id, name_ar, source, in_tarmeez, detective_status) values ('test:sw1', 'أ', 'test', true, 'pending'), ('test:sw2', 'ب', 'test', true, 'pending'), ('test:sw3', 'ج', 'test', true, 'ok')`;
    await sql`insert into capabilities (supplier_id, tariff_code, hs6, class) values ('test:sw1', '848180000000', '848180', 'manufacturer'), ('test:sw1', '841370000000', '841370', 'manufacturer'), ('test:sw2', '848180000000', '848180', 'manufacturer'), ('test:sw2', '040310000000', '040310', 'manufacturer'), ('test:sw3', '848180000000', '848180', 'manufacturer')`;
  });
  test("orders pending suppliers by sector capability count", async () => {
    const rows = (await selectSwarmSuppliers(sql, { limit: 5000, headings: ["8481", "8413", "7307"] })).filter((r) => r.id.startsWith("test:sw"));
    expect(rows.map((r) => r.id)).toEqual(["test:sw1", "test:sw2"]);
    expect(rows[0]!.n).toBe(2);
  });
  test("audit targets are sector capabilities of investigated suppliers without an audit", async () => {
    const ids = await selectAuditTargets(sql, { limit: 5000, headings: ["8481"] });
    const [cap] = await sql<{ id: string }[]>`select id from capabilities where supplier_id = 'test:sw3'`;
    expect(ids).toContain(cap!.id);
    const [pending] = await sql<{ id: string }[]>`select id from capabilities where supplier_id = 'test:sw1' and hs6 = '848180'`;
    expect(ids).not.toContain(pending!.id);
  });
});
