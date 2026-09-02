import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { loadProfile, mergeFindings } from "../src/detective/persist";
import type { DetectiveFindingsT } from "../src/detective/schema";

describe.skipIf(!process.env.DATABASE_URL)("mergeFindings", () => {
  beforeAll(async () => {
    await migrate(sql);
    await sql`delete from suppliers where id = 'test:det'`;
    await sql`insert into suppliers (id, name_ar, name_en, city_en, source, in_tarmeez) values ('test:det', 'مصنع الاختبار للصمامات', 'Test Valves Factory', 'Dammam', 'test', true)`;
    await sql`insert into products (tariff_code, hs6, title_ar, title_en, source) values ('848180000000', '848180', 'صمامات', 'Valves', 'test') on conflict do nothing`;
    await sql`insert into capabilities (supplier_id, tariff_code, hs6, class, declared_amount, declared_unit) values ('test:det', '848180000000', '848180', 'manufacturer', 100, 'Ton')`;
  });

  test("attaches evidence to the declared capability by hs6 or by product words, creates new ones for other findings, tiers self-published claims at 3", async () => {
    const [run] = await sql<{ id: string }[]>`insert into runs (role, input_ref, model) values ('detective', 'test:det', 'm') returning id`;
    const profile = await loadProfile(sql, "test:det");
    expect(profile.declared).toHaveLength(1);
    const findings: DetectiveFindingsT = {
      website: "https://testvalves.example", is_same_company: true,
      capabilities: [
        { product: "stainless ball valves", hs6_guess: "848180", class_guess: "manufacturer", spec_attrs: [{ key: "size", value: "1/2 to 12 inch" }], evidence: [{ url: "https://testvalves.example/products", excerpt: "ball valves", kind: "catalogue" }] },
        { product: "  centrifugal   pumps ", hs6_guess: "841370", class_guess: "authorised_distributor", spec_attrs: [], evidence: [{ url: "https://www.dnb.com/x", excerpt: "distributes pumps", kind: "directory" }] },
        { product: "Gate Valves (Model B7000)", hs6_guess: null, class_guess: "manufacturer", spec_attrs: [], evidence: [{ url: "https://testvalves.example/gate", excerpt: "gate valves", kind: "website" }] },
      ],
      certifications: [{ name: "ISO 9001", url: "https://testvalves.example/iso", excerpt: "certified" }, { name: "SASO", url: "https://saso.gov.sa/cert/1", excerpt: "listed" }],
      signals: { employees: "80", capacity: null, facility: null }, summary: "A valve maker.",
    };
    const merged = await mergeFindings(sql, profile, findings, run!.id, [{ url: "https://testvalves.example/products", title: "Products", snippet: "", text: null, kind: "own_site", tier: 3, score: 1 }]);
    expect(merged.created).toBe(1);
    const caps = await sql<{ hs6: string; origin: string; class: string; product_title: string | null }[]>`select hs6, origin, class, product_title from capabilities where supplier_id = 'test:det' order by hs6`;
    expect(Array.from(caps)).toEqual([{ hs6: "841370", origin: "detective", class: "authorised_distributor", product_title: "centrifugal pumps" }, { hs6: "848180", origin: "tarmeez", class: "manufacturer", product_title: null }]);
    const ev = await sql<{ tier: number; source_type: string }[]>`select e.tier, e.source_type from evidence e join capabilities c on c.id = e.capability_id where c.supplier_id = 'test:det' order by e.tier, e.source_type`;
    expect(ev.map((e) => [e.tier, e.source_type])).toEqual([[1, "certification"], [1, "certification"], [2, "directory"], [3, "catalogue"], [3, "certification"], [3, "certification"], [3, "website"]]);
    const [gate] = await sql<{ n: number }[]>`select count(*)::int as n from evidence e join capabilities c on c.id = e.capability_id where c.supplier_id = 'test:det' and c.hs6 = '848180' and c.origin = 'tarmeez' and e.source_url like '%/gate'`;
    expect(gate!.n).toBe(1);
    const [s] = await sql<{ website: string; detective_status: string; summary: string }[]>`select website, detective_status, summary from suppliers where id = 'test:det'`;
    expect(s).toEqual({ website: "https://testvalves.example", detective_status: "ok", summary: "A valve maker." });
  });

  test("is idempotent for the same run", async () => {
    const [run] = await sql<{ id: string }[]>`select detective_run_id as id from suppliers where id = 'test:det'`;
    const before = await sql<{ n: number }[]>`select count(*)::int as n from evidence e join capabilities c on c.id = e.capability_id where c.supplier_id = 'test:det'`;
    const profile = await loadProfile(sql, "test:det");
    const again: DetectiveFindingsT = { website: null, is_same_company: true, capabilities: [{ product: "stainless ball valves", hs6_guess: "848180", class_guess: "manufacturer", spec_attrs: [], evidence: [{ url: "https://testvalves.example/products", excerpt: "ball valves", kind: "catalogue" }] }], certifications: [], signals: { employees: null, capacity: null, facility: null }, summary: "" };
    await mergeFindings(sql, profile, again, run!.id, []);
    const after = await sql<{ n: number }[]>`select count(*)::int as n from evidence e join capabilities c on c.id = e.capability_id where c.supplier_id = 'test:det'`;
    expect(after[0]!.n).toBeLessThanOrEqual(before[0]!.n);
  });
});
