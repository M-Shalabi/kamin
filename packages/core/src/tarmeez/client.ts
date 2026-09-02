import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pLimit from "p-limit";
import type { TarmeezCategory } from "../hs/codes";

export const TARMEEZ_BASE = "https://psnr.mim.gov.sa/CatalogApi/api/v1";
import { REPO_ROOT } from "../paths";

export type Bilingual = { Ar: string; En: string };
export type PlantListItem = { Id: number; Title: Bilingual };
export type PlantProduct = { Id: number; Title: Bilingual; Amount: number | null; Unit: Bilingual | null; Symbol: Bilingual };
export type PlantDetail = {
  Id: number; Title: Bilingual; CommercialRecordNo: string | null; Email: string | null;
  LegalAuthority: Bilingual | null; Location: Bilingual | null; MobileNo: string | null; PhoneNo: string | null;
  WebSiteUrl: string | null; Symbol: Bilingual | null; MainActivity: unknown; Governorate: Bilingual | null;
  InvestmentType: Bilingual | null; Products: PlantProduct[] | null;
};
export type ProductListItem = { Id: number; Title: Bilingual; Symbol: Bilingual };
type Page<T> = { TotalCount: number; PageIndex: number; PageSize: number; Items: T[] };

export type TarmeezClientOptions = {
  fetchImpl?: typeof fetch;
  cacheDir?: string;
  concurrency?: number;
  delayMs?: number;
  retryBaseMs?: number;
  pageSize?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class TarmeezClient {
  private fetchImpl: typeof fetch;
  private cacheDir: string;
  private limit: ReturnType<typeof pLimit>;
  private delayMs: number;
  private retryBaseMs: number;
  private pageSize: number;

  constructor(opts: TarmeezClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.cacheDir = opts.cacheDir ?? join(REPO_ROOT, "data/raw/tarmeez");
    this.limit = pLimit(opts.concurrency ?? 4);
    this.delayMs = opts.delayMs ?? 200;
    this.retryBaseMs = opts.retryBaseMs ?? 500;
    this.pageSize = opts.pageSize ?? 1000;
  }

  private cachePath(path: string): string {
    return join(this.cacheDir, path.replace(/^\//, "").replace(/[^A-Za-z0-9._-]+/g, "_") + ".json");
  }

  async fetchJson<T>(path: string): Promise<T> {
    const file = this.cachePath(path);
    try {
      return JSON.parse(await readFile(file, "utf8")) as T;
    } catch {}
    return this.limit(async () => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await this.fetchImpl(TARMEEZ_BASE + path, {
            headers: { accept: "application/json", "user-agent": "KAMIN research client (PIF Innovate Hackathon)" },
          });
          if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
          if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} for ${path}`), { fatal: true });
          const body = (await res.json()) as T;
          await mkdir(this.cacheDir, { recursive: true });
          await writeFile(file, JSON.stringify(body));
          await sleep(this.delayMs);
          return body;
        } catch (err) {
          lastError = err;
          if ((err as { fatal?: boolean }).fatal) throw err;
          await sleep(this.retryBaseMs * 2 ** attempt);
        }
      }
      throw lastError;
    });
  }

  async categories(): Promise<TarmeezCategory[]> {
    const page = await this.fetchJson<Page<TarmeezCategory>>("/products/categories?pageIndex=1&pageSize=50");
    return page.Items;
  }

  private async *pages<T>(path: string, pageSize: number): AsyncGenerator<T> {
    for (let pageIndex = 1; ; pageIndex++) {
      const page = await this.fetchJson<Page<T>>(`${path}?pageIndex=${pageIndex}&pageSize=${pageSize}`);
      for (const item of page.Items) yield item;
      if (page.Items.length < pageSize) return;
    }
  }

  listPlants(): AsyncGenerator<PlantListItem> {
    return this.pages<PlantListItem>("/factories/plants", this.pageSize);
  }

  listProducts(): AsyncGenerator<ProductListItem> {
    return this.pages<ProductListItem>("/factories/products", Math.min(this.pageSize, 500));
  }

  plantDetail(id: number): Promise<PlantDetail> {
    return this.fetchJson<PlantDetail>(`/factories/plants/${id}`);
  }
}
