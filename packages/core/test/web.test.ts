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

/** A minimal one-page PDF with one text object, offsets computed so the xref table is valid. */
export function minimalPdf(text: string): Uint8Array {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 12 Tf 72 712 Td (${text.replace(/[()\\]/g, "\\$&")}) Tj ET`;
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

describe("fetchText with a PDF", () => {
  test("extracts the text of a PDF document and titles it from the file name", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const dir = await mkdtemp(`${tmpdir()}/kamin-pdf-`);
    const fake = (async () => new Response(new Blob([minimalPdf("Ball valves PN16 DN15 to DN300 stainless steel 316") as unknown as BlobPart]), { status: 200, headers: { "content-type": "application/pdf" } })) as unknown as typeof fetch;
    const r = await fetchText("https://example.com/downloads/valve-catalogue.pdf", { fetchImpl: fake, cacheDir: dir });
    expect(r?.text).toContain("Ball valves PN16");
    expect(r?.text).toContain("stainless steel 316");
    expect(r?.title).toBe("valve-catalogue.pdf");
  });
});

describe("extractLinks", () => {
  test("returns absolute, deduplicated http links from anchors, resolving relative hrefs against the page", async () => {
    const { extractLinks } = await import("../src/web/fetch");
    const html = `<a href="/downloads/catalogue.pdf">Catalogue</a> <a href='products/ball-valves'>Ball</a> <A HREF="https://other.example/x">x</A> <a href="/downloads/catalogue.pdf">again</a> <a href="mailto:a@b.c">mail</a> <a href="#top">top</a>`;
    expect(extractLinks(html, "https://bariqgroup.com/en/products")).toEqual(["https://bariqgroup.com/downloads/catalogue.pdf", "https://bariqgroup.com/en/products/ball-valves", "https://other.example/x"]);
  });
  test("fetchText keeps the links of an HTML page", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kamin-links-"));
    const fake = (async () => new Response(`<html><head><title>P</title></head><body><a href="/c.pdf">c</a></body></html>`, { status: 200, headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
    const r = await fetchText("https://bariqgroup.com/p", { fetchImpl: fake, cacheDir: dir });
    expect(r?.links).toEqual(["https://bariqgroup.com/c.pdf"]);
  });
});

describe("fetchText cache without links", () => {
  test("refetches an HTML page cached before links were recorded, and stores the links", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kamin-stale-"));
    const { createHash } = await import("node:crypto");
    const { writeFile } = await import("node:fs/promises");
    const url = "https://bariqgroup.com/products";
    await writeFile(join(dir, createHash("sha1").update(url).digest("hex") + ".json"), JSON.stringify({ url, title: "old", text: "old text" }));
    let calls = 0;
    const fake = (async () => { calls++; return new Response(`<html><head><title>New</title></head><body><a href="/c.pdf">c</a></body></html>`, { status: 200, headers: { "content-type": "text/html" } }); }) as unknown as typeof fetch;
    const r = await fetchText(url, { fetchImpl: fake, cacheDir: dir });
    expect(calls).toBe(1);
    expect(r?.links).toEqual(["https://bariqgroup.com/c.pdf"]);
    const again = await fetchText(url, { fetchImpl: fake, cacheDir: dir });
    expect(calls).toBe(1);
    expect(again?.title).toBe("New");
  });
});
