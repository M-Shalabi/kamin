import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { extractMembers, loadMembers } from "../src/madeinsaudi/load";

const captured = [
  { id: 535, list: { id: 535, company_registered_name: "Southern Can Making Company Limited (SCMC)", brand_name_english: "SCMC", brand_name_arabic: "إس سي إم سي", company_registered_name_arabic: "شركة الجنوب لصناعة العلب المحدودة" }, detail: { id: 535, company_short_description_english: "Cans.", form_company_registration: { commercial_registration_number: "4030012345", sector: "Packaging", company_registered_name: "Southern Can Making Company Limited (SCMC)" } }, products: [{ product_name_english: "Aluminium cans" }] },
  { id: 9, list: { id: 9, company_registered_name: "Kanoo Valves", company_registered_name_arabic: "كانو للصمامات" }, detail: null, products: [] },
];

describe("extractMembers", () => {
  test("reads the captured shape: names, CR number, sector and products", () => {
    const m = extractMembers(captured);
    expect(m).toHaveLength(2);
    expect(m[0]).toMatchObject({ id: 535, name: "Southern Can Making Company Limited (SCMC)", name_arabic: "شركة الجنوب لصناعة العلب المحدودة", cr_number: "4030012345", sector: "Packaging", products: ["Aluminium cans"], description: "Cans." });
    expect(m[1]).toMatchObject({ id: 9, name: "Kanoo Valves", cr_number: null, products: [] });
  });
});

describe.skipIf(!process.env.DATABASE_URL)("loadMembers", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from suppliers where id like 'test:mis%'`;
    await sql`insert into suppliers (id, name_ar, name_en, cr_number, source, in_tarmeez) values ('test:mis1', 'مصنع كانو للصمامات', 'Kanoo Valves Factory', null, 'test', true), ('test:mis2', 'مصنع بعيد', 'Far Away Factory', null, 'test', true), ('test:mis3', 'شركة العلب', 'Cans Co', '4030012345', 'test', true)`;
    await sql`insert into products (tariff_code, hs6, title_ar, title_en, source) values ('848180000000', '848180', 'صمامات', 'Valves', 'test') on conflict do nothing`;
    await sql`insert into capabilities (supplier_id, tariff_code, hs6, class) values ('test:mis1', '848180000000', '848180', 'manufacturer'), ('test:mis3', '848180000000', '848180', 'manufacturer')`;
  });
  test("matches by CR first, then by name, and writes tier-1 certification evidence", async () => {
    const r = await loadMembers(sql, extractMembers(captured), { onlyIds: ["test:mis1", "test:mis2", "test:mis3"] });
    expect(r.matched_cr).toBe(1);
    expect(r.matched_name).toBe(1);
    const rows = await sql<{ id: string; in_made_in_saudi: boolean }[]>`select id, in_made_in_saudi from suppliers where id like 'test:mis%' order by id`;
    expect([...rows]).toEqual([{ id: "test:mis1", in_made_in_saudi: true }, { id: "test:mis2", in_made_in_saudi: false }, { id: "test:mis3", in_made_in_saudi: true }]);
    const ev = await sql<{ tier: number; source_type: string }[]>`select e.tier, e.source_type from evidence e join capabilities c on c.id = e.capability_id where c.supplier_id = 'test:mis3'`;
    expect([...ev]).toEqual([{ tier: 1, source_type: "certification" }]);
  });
});
