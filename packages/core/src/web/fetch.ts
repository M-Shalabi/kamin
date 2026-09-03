import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { REPO_ROOT } from "../paths";
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "-", mdash: "-", hellip: "...", laquo: "«", raquo: "»", copy: "©", reg: "®", trade: "™" };

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(head|script|style|noscript|svg|nav|footer|header|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|br|td|th|section|article)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped).replace(/\s+/g, " ").trim();
}

export function htmlTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]!).replace(/\s+/g, " ").trim() || null : null;
}

/** Absolute, deduplicated http(s) links from a page's anchors, relative hrefs resolved against the page URL. */
export function extractLinks(html: string, baseUrl: string): string[] {
  const out: string[] = []; const seen = new Set<string>();
  for (const m of html.matchAll(/<a\s[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const href = (m[1] ?? m[2] ?? "").trim();
    if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    try { const u = new URL(href, baseUrl); u.hash = ""; const abs = u.toString(); if (/^https?:/.test(abs) && !seen.has(abs)) { seen.add(abs); out.push(abs); } } catch { /* not a URL */ }
  }
  return out;
}

export async function fetchText(url: string, opts: { fetchImpl?: typeof fetch; cacheDir?: string; maxChars?: number } = {}): Promise<{ url: string; title: string | null; text: string; links: string[] } | null> {
  const cacheDir = opts.cacheDir ?? join(REPO_ROOT, "data/raw/pages");
  const maxChars = opts.maxChars ?? 12_000;
  const file = join(cacheDir, createHash("sha1").update(url).digest("hex") + ".json");
  try {
    const cached = JSON.parse(await readFile(file, "utf8")) as { url: string; title: string | null; text: string; links?: string[] } | null;
    return cached && { ...cached, links: cached.links ?? [], text: cached.text.slice(0, maxChars) };
  } catch {}
  let result: { url: string; title: string | null; text: string; links: string[] } | null = null;
  try {
    const res = await (opts.fetchImpl ?? fetch)(url, { headers: { "user-agent": "KAMIN research client (PIF Innovate Hackathon)", accept: "text/html,application/xhtml+xml,application/pdf" }, signal: AbortSignal.timeout(20_000), redirect: "follow" });
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && (/pdf/i.test(type) || /\.pdf(?:$|[?#])/i.test(url))) {
      // Catalogues and datasheets: extract the text of every page, merged.
      const { extractText } = await import("unpdf");
      const { text } = await extractText(new Uint8Array(await res.arrayBuffer()), { mergePages: true });
      const name = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "") || null;
      result = { url, title: name, text: String(text).replace(/\s+/g, " ").trim().slice(0, maxChars), links: [] };
    } else if (res.ok && /html|xml|text\/plain/i.test(type)) {
      const html = await res.text();
      result = { url, title: htmlTitle(html), text: htmlToText(html).slice(0, maxChars), links: extractLinks(html, url).slice(0, 300) };
    }
  } catch {
    result = null;
  }
  await mkdir(cacheDir, { recursive: true });
  await writeFile(file, JSON.stringify(result));
  return result;
}
