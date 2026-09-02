import { describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { coldMiss } from "../src/coldmiss";
import { ollamaUp } from "../src/models/registry";

describe.skipIf(!process.env.DATABASE_URL || !process.env.TAVILY_API_KEY || !(await ollamaUp()))("coldMiss live", () => {
  test("investigates and audits one pending Tarmeez supplier, streaming lines to the sink", async () => {
    const [s] = await sql<{ id: string }[]>`select s.id from suppliers s join capabilities c on c.supplier_id = s.id where s.in_tarmeez and s.detective_status = 'pending' and c.hs6 like '8481%' order by s.id limit 1`;
    if (!s) return;
    const lines: string[] = [];
    const r = await coldMiss(sql, s.id, (l) => lines.push(l));
    expect(lines.some((l) => l.startsWith("▶ run"))).toBe(true);
    expect(lines.some((l) => l.startsWith("▷ done"))).toBe(true);
    expect(r.audits.length).toBeGreaterThanOrEqual(1);
    const [row] = await sql<{ detective_status: string }[]>`select detective_status from suppliers where id = ${s.id}`;
    expect(row!.detective_status).toBe("ok");
  }, 600_000);
});
