import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../../../..");
export type TavilyResult = { title: string; url: string; content: string; raw_content: string | null; score: number };

export async function searchTavily(query: string, opts: { maxResults?: number; fetchImpl?: typeof fetch; cacheDir?: string } = {}): Promise<TavilyResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY is not set");
  const maxResults = opts.maxResults ?? 5;
  const cacheDir = opts.cacheDir ?? join(REPO_ROOT, "data/raw/tavily");
  const file = join(cacheDir, createHash("sha1").update(`${query}|${maxResults}`).digest("hex") + ".json");
  try {
    return JSON.parse(await readFile(file, "utf8")) as TavilyResult[];
  } catch {}
  const res = await (opts.fetchImpl ?? fetch)("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, max_results: maxResults, search_depth: "basic", include_raw_content: true }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`tavily ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { results?: Partial<TavilyResult>[] };
  const results: TavilyResult[] = (body.results ?? []).map((r) => ({
    title: String(r.title ?? ""), url: String(r.url ?? ""), content: String(r.content ?? ""),
    raw_content: typeof r.raw_content === "string" && r.raw_content.length ? r.raw_content : null, score: Number(r.score ?? 0),
  }));
  await mkdir(cacheDir, { recursive: true });
  await writeFile(file, JSON.stringify(results));
  return results;
}
