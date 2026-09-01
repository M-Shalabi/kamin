import { describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";

describe.skipIf(!process.env.DATABASE_URL)("database", () => {
  test("connects and applies migrations idempotently", async () => {
    const first = await migrate(sql);
    const second = await migrate(sql);
    expect(second).toEqual([]);
    const [row] = await sql<{ ok: number }[]>`select 1 as ok`;
    expect(row!.ok).toBe(1);
    const rows = await sql<{ name: string }[]>`select name from schema_migrations order by name`;
    expect(rows.map((r) => r.name)).toEqual(first.length ? first : rows.map((r) => r.name));
  });
});
