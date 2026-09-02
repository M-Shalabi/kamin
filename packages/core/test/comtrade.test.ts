import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchImports } from "../src/comtrade/ingest";

describe("fetchImports", () => {
  test("requests the codes in one paced call, maps primaryValue, and caches", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kamin-comtrade-"));
    let calls = 0;
    const fetchImpl = (async (u: string | URL | Request) => {
      calls++;
      expect(String(u)).toContain("cmdCode=848180,848130");
      return new Response(JSON.stringify({ count: 2, data: [
        { cmdCode: "848180", period: "2024", primaryValue: 1865610792.026, netWgt: 113392119.54, qty: 113392119.54 },
        { cmdCode: "848130", period: "2024", primaryValue: 142800000, netWgt: null, qty: null },
      ] }), { status: 200 });
    }) as unknown as typeof fetch;
    const a = await fetchImports(["848180", "848130"], { fetchImpl, cacheDir: dir, delayMs: 0 });
    const b = await fetchImports(["848180", "848130"], { fetchImpl, cacheDir: dir, delayMs: 0 });
    expect(a).toEqual([{ hs6: "848180", year: 2024, value_usd: 1865610792.026, net_wgt: 113392119.54, qty: 113392119.54 }, { hs6: "848130", year: 2024, value_usd: 142800000, net_wgt: null, qty: null }]);
    expect(b).toEqual(a);
    expect(calls).toBe(1);
  });
});
