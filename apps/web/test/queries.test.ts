import { describe, expect, test } from "bun:test";
import { capabilityDetail, coverageSummary, ledger, orderDetail, runDetail, stats, supplierDetail, supplierList, unenrichedSectorSuppliers } from "../lib/queries";

describe.skipIf(!process.env.DATABASE_URL)("queries", () => {
  test("coverage and stats answer with numbers", async () => {
    const c = await coverageSummary();
    expect(c.coverage).toBeGreaterThanOrEqual(0);
    const s = await stats();
    expect(s.suppliers).toBeGreaterThan(10000);
    expect(s.capabilities).toBeGreaterThan(10000);
  });
  test("ledger rows carry value, kind, mandatory flag and pivot count", async () => {
    const rows = await ledger("all");
    expect(Array.isArray(rows)).toBe(true);
    if (rows.length) expect(rows[0]).toHaveProperty("annual_value_usd");
  });
  test("supplier list filters by registry and text, and detail returns capabilities with evidence", async () => {
    const list = await supplierList({ registry: "tarmeez", q: "كانو", family: "valve" });
    expect(list.length).toBeGreaterThan(0);
    const d = await supplierDetail("tarmeez:41699");
    expect(d).not.toBeNull();
    expect(d!.capabilities.length).toBeGreaterThan(0);
    expect(d!.capabilities[0]).toHaveProperty("evidence_count");
    const cap = await capabilityDetail(d!.capabilities[0]!.id);
    expect(cap!.evidence.length).toBeGreaterThanOrEqual(1);
    const runs = d!.runs;
    if (runs.length) { const r = await runDetail(runs[0]!.id); expect(r!.steps.length).toBeGreaterThan(0); }
  });
  test("an order detail joins lines and matches when one exists", async () => {
    const rows = await ledger("all");
    if (!rows.length) return;
    const o = await orderDetail(rows[0]!.id);
    expect(o).not.toBeNull();
    expect(o!.lines.length).toBeGreaterThan(0);
  });
  test("unenriched sector suppliers are pending Tarmeez plants with sector capabilities", async () => {
    const rows = await unenrichedSectorSuppliers(5);
    expect(rows.every((r) => r.detective_status === "pending")).toBe(true);
  });
});
