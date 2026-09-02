import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

import { REPO_ROOT } from "../paths";
const OUT_DIR = join(REPO_ROOT, "data/raw/saudimade");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type CapturedMember = { id: number; list: Record<string, unknown>; detail: Record<string, unknown> | null; products: unknown[] };

/** Scroll the public members directory in a real browser to enumerate members, then fetch each member's public Next.js data file. */
export async function captureMembers(opts: { headless?: boolean; scanTo?: number; missRun?: number; fetchImpl?: typeof fetch } = {}): Promise<{ file: string; members: number; details: number; buildId: string }> {
  await mkdir(join(OUT_DIR, "members"), { recursive: true });
  const browser = await chromium.launch({ headless: opts.headless ?? true });
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" });
  const listed = new Map<number, Record<string, unknown>>();
  page.on("response", async (res) => {
    if (!/api\.saudimade\.sa\/form-company-contents\/search/.test(res.url())) return;
    try { const body = (await res.json()) as { members?: Record<string, unknown>[] }; for (const m of body.members ?? []) if (typeof m.id === "number") listed.set(m.id, m); } catch {}
  });
  await page.goto("https://saudimade.sa/en/members", { waitUntil: "networkidle", timeout: 90_000 });
  const buildId = (await page.evaluate(() => (window as unknown as { __NEXT_DATA__?: { buildId?: string } }).__NEXT_DATA__?.buildId)) ?? "";
  await browser.close();
  if (!buildId) throw new Error("could not read the Next.js build id from the members page");

  // Every member has a public page at /en/members/<id>; its data file is public too. Scan ids until a long run of misses.
  const fetchImpl = opts.fetchImpl ?? fetch;
  const members: CapturedMember[] = [];
  let details = 0, misses = 0, lastHit = 0;
  const scanTo = opts.scanTo ?? 3000;
  const missRun = opts.missRun ?? 300;
  for (let id = 1; id <= scanTo; id++) {
    const file = join(OUT_DIR, "members", `${id}.json`);
    let data: { pageProps?: { data?: Record<string, unknown> | null; products?: unknown[] } } | null | undefined;
    try { data = JSON.parse(await readFile(file, "utf8")); } catch {
      try {
        const res = await fetchImpl(`https://saudimade.sa/_next/data/${buildId}/en/members/${id}.json`, { headers: { "user-agent": "KAMIN research client (PIF Innovate Hackathon)" }, signal: AbortSignal.timeout(30_000) });
        const body = res.ok ? ((await res.json()) as typeof data) : null;
        data = body?.pageProps?.data ? { pageProps: { data: body.pageProps.data, products: body.pageProps.products ?? [] } } : null;
        if (res.ok || res.status === 404) await writeFile(file, JSON.stringify(data));
        await sleep(120);
      } catch { data = undefined; }
    }
    if (data?.pageProps?.data) {
      details++; lastHit = id; misses = 0;
      members.push({ id, list: listed.get(id) ?? {}, detail: data.pageProps.data, products: data.pageProps.products ?? [] });
    } else if (lastHit > 0 && ++misses >= missRun) break;
  }
  const file = join(OUT_DIR, "members.json");
  await writeFile(file, JSON.stringify(members));
  return { file, members: members.length, details, buildId };
}
