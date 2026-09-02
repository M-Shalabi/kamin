import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchText, htmlToText } from "../src/web/fetch";
import { searchTavily } from "../src/web/tavily";

describe("htmlToText", () => {
  test("drops scripts, styles and tags, decodes entities and collapses whitespace", () => {
    const html = `<html><head><title>T</title><style>.a{}</style><script>var x=1;</script></head><body><nav>menu</nav><h1>Valves &amp; Pumps</h1><p>Ball&nbsp;valves 2&quot; SS316<br>Class 150</p></body></html>`;
    expect(htmlToText(html)).toBe("Valves & Pumps Ball valves 2\" SS316 Class 150");
  });
});

describe("searchTavily", () => {
  test("posts the query, returns results and caches them on disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kamin-tavily-"));
    let calls = 0;
    const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      expect(body.query).toBe("kanoo valves");
      return new Response(JSON.stringify({ results: [{ title: "Kanoo", url: "https://kanoo.example", content: "c", raw_content: "raw", score: 0.9 }] }), { status: 200 });
    }) as unknown as typeof fetch;
    process.env.TAVILY_API_KEY = process.env.TAVILY_API_KEY ?? "test-key";
    const a = await searchTavily("kanoo valves", { fetchImpl, cacheDir: dir });
    const b = await searchTavily("kanoo valves", { fetchImpl, cacheDir: dir });
    expect(a).toHaveLength(1);
    expect(a[0]!.url).toBe("https://kanoo.example");
    expect(b).toEqual(a);
    expect(calls).toBe(1);
  });
});

describe("fetchText", () => {
  test("fetches, extracts text, caps length and caches", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kamin-pages-"));
    let calls = 0;
    const fetchImpl = (async () => { calls++; return new Response(`<html><head><title>Kanoo Valves</title></head><body><p>${"valve ".repeat(5000)}</p></body></html>`, { status: 200, headers: { "content-type": "text/html" } }); }) as unknown as typeof fetch;
    const a = await fetchText("https://kanoo.example/products", { fetchImpl, cacheDir: dir, maxChars: 1000 });
    const b = await fetchText("https://kanoo.example/products", { fetchImpl, cacheDir: dir, maxChars: 1000 });
    expect(a!.title).toBe("Kanoo Valves");
    expect(a!.text.length).toBeLessThanOrEqual(1000);
    expect(b).toEqual(a);
    expect(calls).toBe(1);
  });
  test("returns null for non-html or failed responses", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kamin-pages-"));
    const fetchImpl = (async () => new Response("%PDF-1.4", { status: 200, headers: { "content-type": "application/pdf" } })) as unknown as typeof fetch;
    expect(await fetchText("https://x.example/a.pdf", { fetchImpl, cacheDir: dir })).toBeNull();
    const failing = (async () => new Response("nope", { status: 503 })) as unknown as typeof fetch;
    expect(await fetchText("https://x.example/b", { fetchImpl: failing, cacheDir: dir })).toBeNull();
  });
});
