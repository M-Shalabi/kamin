import type { TavilyResult } from "../web/tavily";
import { nameTokens, type SupplierProfile } from "./queries";

export type PageKind = "own_site" | "directory" | "certification" | "news" | "social" | "other";
export type PageCandidate = { url: string; title: string; snippet: string; text: string | null; kind: PageKind; tier: 1 | 2 | 3; score: number };

const SOCIAL = /instagram\.com|facebook\.com|twitter\.com|(^|\.)x\.com|tiktok\.com|youtube\.com|snapchat\.com|threads\.net/i;
const DIRECTORY = /linkedin\.com|dnb\.com|kompass\.com|saudiindustryguide|yellowpages|saudiyp|daleel|tradekey|exporthub|eworldtrade|europages|indiamart|alibaba\.com|made-in-china|zawya\.com\/companies|mcci\.org\.sa|chamber|psnr\.mim\.gov\.sa|lc\.mcci/i;
const CERT = /saudimade\.sa|iso\.org|saso\.gov\.sa|sfda\.gov\.sa|lcgpa\.gov\.sa|iktva|nusaned/i;
const NEWS = /arabnews|saudigazette|argaam|alriyadh|okaz|aleqt|spa\.gov\.sa|zawya\.com\/press|gulfnews|khaleejtimes|news/i;

export function classifyUrl(url: string, supplierTokens: string[]): { kind: PageKind; tier: 1 | 2 | 3 } {
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { return { kind: "other", tier: 3 }; }
  if (CERT.test(host)) return { kind: "certification", tier: 1 };
  if (SOCIAL.test(host)) return { kind: "social", tier: 3 };
  if (DIRECTORY.test(host)) return { kind: "directory", tier: 2 };
  const bare = host.replace(/^www\./, "").replace(/\.(com|sa|net|org|co|ae|biz|info)(\.sa)?$/g, "").replace(/[^a-z]/g, "");
  if (supplierTokens.some((t) => /^[a-z]{4,}$/.test(t) && bare.includes(t))) return { kind: "own_site", tier: 3 };
  if (NEWS.test(host)) return { kind: "news", tier: 3 };
  return { kind: "other", tier: 3 };
}

const KIND_RANK: Record<PageKind, number> = { own_site: 0, certification: 1, directory: 2, news: 3, other: 4, social: 5 };

export function selectPages(s: SupplierProfile, results: TavilyResult[], max = 4): PageCandidate[] {
  const tokens = nameTokens(s);
  const seen = new Set<string>();
  const pages: PageCandidate[] = [];
  for (const r of results) {
    if (!r.url || seen.has(r.url)) continue;
    seen.add(r.url);
    const { kind, tier } = classifyUrl(r.url, tokens);
    pages.push({ url: r.url, title: r.title, snippet: r.content, text: r.raw_content, kind, tier, score: r.score });
  }
  pages.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || b.score - a.score);
  const nonSocial = pages.filter((p) => p.kind !== "social");
  return (nonSocial.length ? nonSocial : pages).slice(0, max);
}
