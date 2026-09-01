import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TarmeezClient } from "../src/tarmeez/client";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("TarmeezClient", () => {
  test("caches a response on disk and does not refetch", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kamin-"));
    let calls = 0;
    const fetchImpl = (async () => { calls++; return jsonResponse({ TotalCount: 1, Items: [{ Id: 1, Title: { Ar: "أ", En: "a" } }] }); }) as typeof fetch;
    const client = new TarmeezClient({ fetchImpl, cacheDir: dir, delayMs: 0 });
    const a = await client.fetchJson<{ TotalCount: number }>("/factories/plants?pageIndex=1&pageSize=1000");
    const b = await client.fetchJson<{ TotalCount: number }>("/factories/plants?pageIndex=1&pageSize=1000");
    expect(a.TotalCount).toBe(1);
    expect(b).toEqual(a);
    expect(calls).toBe(1);
  });

  test("retries a 503 then succeeds", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kamin-"));
    let calls = 0;
    const fetchImpl = (async () => { calls++; return calls < 3 ? jsonResponse({}, 503) : jsonResponse({ ok: true }); }) as typeof fetch;
    const client = new TarmeezClient({ fetchImpl, cacheDir: dir, delayMs: 0, retryBaseMs: 1 });
    const r = await client.fetchJson<{ ok: boolean }>("/x");
    expect(r.ok).toBe(true);
    expect(calls).toBe(3);
  });

  test("listPlants pages until a short page", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kamin-"));
    const pages: Record<string, unknown> = {
      "pageIndex=1": { TotalCount: 3, Items: [{ Id: 1, Title: { Ar: "", En: "" } }, { Id: 2, Title: { Ar: "", En: "" } }] },
      "pageIndex=2": { TotalCount: 3, Items: [{ Id: 3, Title: { Ar: "", En: "" } }] },
    };
    const fetchImpl = (async (url: string | URL | Request) => {
      const u = String(url);
      const key = Object.keys(pages).find((k) => u.includes(k))!;
      return jsonResponse(pages[key]);
    }) as typeof fetch;
    const client = new TarmeezClient({ fetchImpl, cacheDir: dir, delayMs: 0, pageSize: 2 });
    const ids: number[] = [];
    for await (const p of client.listPlants()) ids.push(p.Id);
    expect(ids).toEqual([1, 2, 3]);
  });
});
