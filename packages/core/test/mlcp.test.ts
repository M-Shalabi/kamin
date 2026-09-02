import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lastPageNumber, parseDetailPage, parseListPage } from "../src/mlcp/parse";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { ingestMlcp } from "../src/mlcp/ingest";

const list = readFileSync(join(import.meta.dir, "fixtures/mlcp-list-page.html"), "utf8");
const detail = readFileSync(join(import.meta.dir, "fixtures/mlcp-detail.html"), "utf8");

describe("mlcp parse", () => {
  test("parseListPage yields one factory per card with CR, name and activity", () => {
    const rows = parseListPage(list);
    expect(rows.length).toBe(12);
    expect(rows[0]).toEqual({ cr: "1010640506", name: "شركة اماد الصناعية", activity: "صنع المواد الكيميائية والمنتجات الكيميائية" });
    expect(rows.every((r) => /^\d{10}$/.test(r.cr))).toBe(true);
  });
  test("lastPageNumber reads the pager", () => {
    expect(lastPageNumber(list)).toBeGreaterThanOrEqual(5);
  });
  test("parseDetailPage reads the header fields and dedupes the product table", () => {
    const d = parseDetailPage(detail);
    expect(d.name).toBe("شركة اماد الصناعية");
    expect(d.activity).toBe("صنع المواد الكيميائية والمنتجات الكيميائية");
    expect(d.capacity_total).toContain("56,576");
    expect(d.products.length).toBe(19);
    expect(d.products[0]).toEqual({ name: "عطور وكولونيا", quantity: 288, unit: "طن متري" });
    expect(d.products[1]).toEqual({ name: "شامبو للشعر", quantity: 2000, unit: "طن متري" });
  });
});

describe.skipIf(!process.env.DATABASE_URL)("ingestMlcp", () => {
  beforeAll(async () => { await migrate(sql); });
  test("upserts factories on CR from injected pages and flags matches with Tarmeez", async () => {
    await sql`delete from suppliers where id = 'test:mlcp-match' or (source = 'mlcp' and id = 'mlcp:1010640506')`;
    await sql`insert into suppliers (id, name_ar, cr_number, source, in_tarmeez) values ('test:mlcp-match', 'شركة اماد الصناعية', '1010640506', 'test', true)`;
    const r = await ingestMlcp(sql, { pages: { 1: list }, details: { "1010640506": detail } });
    expect(r.factories).toBe(12);
    expect(r.matched).toBeGreaterThanOrEqual(1);
    const [m] = await sql<{ in_mlcp: boolean }[]>`select in_mlcp from suppliers where id = 'test:mlcp-match'`;
    expect(m!.in_mlcp).toBe(true);
    const crs = parseListPage(list).map((row) => row.cr);
    const [n] = await sql<{ n: number }[]>`select count(distinct cr_number)::int as n from suppliers where in_mlcp and cr_number = any(${crs})`;
    expect(n!.n).toBe(12);
  });
});
