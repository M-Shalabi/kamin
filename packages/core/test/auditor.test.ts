import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/client";
import { AuditVerdictLoose } from "../src/auditor/schema";
import { lensesToVerdict } from "../src/auditor/verdict";
import { runAuditor } from "../src/auditor/run";
import { ollamaUp } from "../src/models/registry";
import type { AuditVerdictT } from "../src/auditor/schema";

const base: AuditVerdictT = { analysis: "", real: { verdict: "supported", reasoning: "r", killer_evidence: null }, at_spec: { verdict: "supported", reasoning: "s" }, local: { class: "trader", reasoning: "l" }, confidence: 0.8 };

describe("auditorPrompt with relations", () => {
  test("puts the relations on record in front of the auditor", async () => {
    const { auditorPrompt } = await import("../src/auditor/run");
    const p = auditorPrompt({ id: "c", supplier_id: "s", supplier_name_en: "Sana", supplier_name_ar: null, city_en: "Riyadh", supplier_summary: null, cr_number: null, hs6: "841370", product_title: "pumps", product_en: null, class: "manufacturer", spec_attrs: {}, declared_amount: null, declared_unit: null, origin: "tarmeez", evidence: [], relations: ["distributes brand Armstrong", "certified by ISO 9001"] });
    expect(p.human).toContain("Relations on record: distributes brand Armstrong; certified by ISO 9001");
  });
});

describe("lensesToVerdict", () => {
  test("both lenses supported gives supported, class from the local lens, tier factor applied", () => {
    expect(lensesToVerdict(base, [3, 2])).toMatchObject({ verdict: "supported", class: "trader", confidence: 0.68, clearAttrs: false });
    expect(lensesToVerdict(base, [1])).toMatchObject({ verdict: "supported", class: "trader", confidence: 0.8 });
    expect(lensesToVerdict(base, [])).toMatchObject({ verdict: "supported", class: "trader", confidence: 0.32 });
  });
  test("a refuted real lens kills the capability and caps confidence; a trader never refutes", () => {
    expect(lensesToVerdict({ ...base, real: { verdict: "refuted", reasoning: "dead", killer_evidence: "CR expired" } }, [2])).toMatchObject({ verdict: "refuted", confidence: 0.2 });
    expect(lensesToVerdict({ ...base, real: { verdict: "refuted", reasoning: "dead", killer_evidence: null }, at_spec: { verdict: "supported", reasoning: "" } }, [1]).verdict).toBe("refuted");
    expect(lensesToVerdict({ ...base, local: { class: "trader", reasoning: "imports" } }, [2]).verdict).toBe("supported");
  });
  test("a refuted spec lens on a real product keeps it supported at category level, strips the attributes and discounts confidence", () => {
    const r = lensesToVerdict({ ...base, at_spec: { verdict: "refuted", reasoning: "PN16 never shown" } }, [2], { attrsClaimed: true });
    expect(r).toMatchObject({ verdict: "supported", clearAttrs: true });
    expect(r.confidence).toBeCloseTo(0.8 * 0.85 * 0.6, 2);
  });
  test("an unknown real lens leaves the verdict pending", () => {
    expect(lensesToVerdict({ ...base, real: { verdict: "unknown", reasoning: "silent", killer_evidence: null } }, [2]).verdict).toBe("pending");
  });
  test("an unknown spec lens is pending when attributes were claimed and not applicable when none were", () => {
    const silent = { ...base, at_spec: { verdict: "unknown" as const, reasoning: "no spec on record" } };
    expect(lensesToVerdict(silent, [2], { attrsClaimed: true }).verdict).toBe("pending");
    const r = lensesToVerdict(silent, [2], { attrsClaimed: false });
    expect(r).toMatchObject({ verdict: "supported", clearAttrs: false });
    expect(r.confidence).toBeCloseTo(0.8 * 0.85 * 0.8, 2);
  });
  test("coerces sloppy lens values", () => {
    const v = AuditVerdictLoose.parse({ real: { verdict: "Supported", reasoning: "r" }, at_spec: { verdict: "cannot tell", reasoning: "s" }, local: { class: "Authorised Distributor", reasoning: "l" }, confidence: "0.7" });
    const prose = AuditVerdictLoose.parse({ real: { verdict: "supported", reasoning: "r" }, at_spec: "Evidence shows 1/2 to 4 inch stainless valves, so the verdict is supported.", local: "They import and resell, which makes them a trader.", confidence: 0.9 });
    expect(prose.at_spec.verdict).toBe("supported");
    expect(prose.local.class).toBe("trader");
    expect(v.real.verdict).toBe("supported");
    expect(v.at_spec.verdict).toBe("unknown");
    expect(v.local.class).toBe("authorised_distributor");
    expect(v.confidence).toBe(0.7);
  });
});

describe.skipIf(!process.env.DATABASE_URL || !(await ollamaUp()))("runAuditor live", () => {
  beforeAll(async () => {
    await sql`delete from suppliers where id = 'test:aud'`;
    await sql`insert into suppliers (id, name_ar, name_en, city_en, source, summary) values ('test:aud', 'شركة الخليج للتجارة', 'Gulf Trading Co', 'Riyadh', 'test', 'A trading company that imports and resells valves.')`;
    await sql`insert into capabilities (supplier_id, hs6, product_title, class, origin, spec_attrs) values ('test:aud', '848180', 'stainless steel ball valves', 'manufacturer', 'detective', '{"size": "1/2 to 4 inch", "brand": "Italian brand"}')`;
    const [cap] = await sql<{ id: string }[]>`select id from capabilities where supplier_id = 'test:aud'`;
    await sql`insert into evidence (capability_id, tier, source_type, source_url, excerpt) values (${cap!.id}, 3, 'website', 'https://gulftrading.example/valves', 'We are the exclusive importer and stockist of Italian stainless steel ball valves 1/2 to 4 inch for the Saudi market.')`;
  });
  test("classifies an importer as a trader without refuting a real, at-spec capability", async () => {
    const [cap] = await sql<{ id: string }[]>`select id from capabilities where supplier_id = 'test:aud'`;
    const r = await runAuditor(sql, cap!.id);
    expect(["trader", "authorised_distributor"]).toContain(r.class);
    expect(r.verdict).not.toBe("refuted");
    const [row] = await sql<{ class: string; verdict: string; audit_run_id: string }[]>`select class, verdict, audit_run_id from capabilities where id = ${cap!.id}`;
    expect(row!.class).toBe(r.class);
    expect(row!.audit_run_id).toBe(r.runId);
  }, 300_000);
});
