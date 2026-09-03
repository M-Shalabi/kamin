import { describe, expect, test } from "bun:test";
import { pickCatalogueLinks, selectDocuments, specPrompt, specQueries, toSpecAttrs, SpecFindingsLoose } from "../src/detective/spec";
import type { SupplierProfile } from "../src/detective/queries";

const profile: SupplierProfile = { id: "tarmeez:1", name_ar: "مصنع صمامات بارق للصناعة", name_en: "Bareq Valves Factory", city_en: "Dammam", region_en: "Eastern Region", website: "https://bariqgroup.com", cr_number: "1", declared: [{ hs6: "848180", title_en: "Ball valves", title_ar: "صمامات كروية", amount: null, unit: null }] };

describe("specQueries", () => {
  test("asks for catalogues and datasheets on the supplier's own site and by name, in the sector's words", () => {
    const q = specQueries(profile, ["848180", "848130"]);
    expect(q.some((x) => x.includes("site:bariqgroup.com"))).toBe(true);
    expect(q.some((x) => /catalog|datasheet|data sheet/i.test(x))).toBe(true);
    expect(q.some((x) => /valve/i.test(x))).toBe(true);
    expect(q.length).toBeLessThanOrEqual(5);
  });
  test("works without a website", () => {
    const q = specQueries({ ...profile, website: null }, ["841370"]);
    expect(q.every((x) => !x.includes("site:"))).toBe(true);
    expect(q.some((x) => /pump/i.test(x) && /Bareq/i.test(x))).toBe(true);
  });
});

describe("selectDocuments", () => {
  const r = (url: string, title = "t", content = "c", raw: string | null = null) => ({ url, title, content, raw_content: raw, score: 0.5 });
  test("prefers PDFs and product or catalogue pages on the supplier's own site, drops social and unrelated hosts, keeps at most max", () => {
    const docs = selectDocuments(profile, [
      r("https://www.linkedin.com/company/bareq", "LinkedIn"),
      r("https://bariqgroup.com/downloads/ball-valve-catalogue.pdf", "Ball valve catalogue"),
      r("https://bariqgroup.com/products/gate-valves", "Gate valves"),
      r("https://random-news.example.com/story", "story"),
      r("https://third-party.example.com/bareq-valves-datasheet.pdf", "Bareq valves datasheet"),
      r("https://bariqgroup.com/about", "About us"),
    ], 3);
    expect(docs.map((d) => d.url)).toEqual(["https://bariqgroup.com/downloads/ball-valve-catalogue.pdf", "https://third-party.example.com/bareq-valves-datasheet.pdf", "https://bariqgroup.com/products/gate-valves"]);
    expect(docs[0]!.kind).toBe("pdf");
  });
  test("drops third-party documents that never mention the supplier, even PDFs on a certifier's host", () => {
    const docs = selectDocuments(profile, [
      r("https://saso.gov.sa/en/Documents/TR-BM-Part5-Pipes.pdf", "Technical regulation: pipes", "pipes used in water networks"),
      r("https://bariqgroup.com/downloads/catalogue.pdf", "Catalogue"),
    ], 4);
    expect(docs.map((d) => d.url)).toEqual(["https://bariqgroup.com/downloads/catalogue.pdf"]);
  });
});

describe("toSpecAttrs", () => {
  test("canonicalises a product line's stated ranges into the keys the matcher reads", () => {
    expect(toSpecAttrs({ product: "Ball valves", type: "ball", sizes: "DN15 - DN300 (1/2\" to 12\")", pressure: "PN16, PN25, PN40", materials: "stainless steel 316, carbon steel WCB", connections: "flanged, threaded", standards: "API 608, ISO 5211" }))
      .toEqual({ type: "ball", size: "DN15 - DN300 (1/2\" to 12\")", pressure: "PN16, PN25, PN40", material: "stainless steel 316, carbon steel WCB", connection: "flanged, threaded", standard: "API 608, ISO 5211" });
    expect(toSpecAttrs({ product: "x", type: null, sizes: null, pressure: null, materials: null, connections: null, standards: null })).toEqual({});
  });
});

describe("SpecFindingsLoose", () => {
  test("tolerates strings for arrays, missing fields and prose booleans", () => {
    const r = SpecFindingsLoose.parse({ is_same_company: "yes", products: '[{"product": "Gate valves", "type": "gate", "sizes": "2 to 24 inch", "pressure": "class 150-600", "materials": "WCB", "evidence": [{"url": "https://bariqgroup.com/c.pdf", "excerpt": "Gate valves 2-24 in class 150-600"}]}]' });
    expect(r.is_same_company).toBe(true);
    expect(r.products).toHaveLength(1);
    expect(r.products[0]!.evidence[0]!.url).toBe("https://bariqgroup.com/c.pdf");
    expect(r.products[0]!.connections).toBeNull();
  });
});

describe.skipIf(!process.env.DATABASE_URL)("mergeSpecFindings", () => {
  test("attaches stated attributes and catalogue evidence to the supported capability at the anchored subheading and queues it for a fresh audit", async () => {
    const { sql } = await import("../src/db/client");
    const { migrate } = await import("../src/db/migrate");
    const { mergeSpecFindings } = await import("../src/detective/spec");
    const { loadProfile } = await import("../src/detective/persist");
    await migrate(sql);
    await sql`delete from suppliers where id = 'test:spec'`;
    await sql`insert into suppliers (id, name_ar, name_en, city_en, source, in_tarmeez, website) values ('test:spec', 'مصنع الاختبار', 'Spec Test Valves', 'Dammam', 'test', true, 'https://spectest.example')`;
    const [audit] = await sql<{ id: string }[]>`insert into runs (role, input_ref, model, status) values ('auditor', 'test:spec', 'm', 'ok') returning id`;
    await sql`insert into capabilities (supplier_id, hs6, product_title, class, verdict, confidence, origin, audit_run_id) values ('test:spec', '848180', 'ball valves', 'manufacturer', 'supported', 0.8, 'detective', ${audit!.id})`;
    const [run] = await sql<{ id: string }[]>`insert into runs (role, input_ref, model) values ('specifier', 'test:spec', 'm') returning id`;
    const profile = await loadProfile(sql, "test:spec");
    const docs = [{ url: "https://spectest.example/catalogue.pdf", title: "catalogue.pdf", snippet: "", text: "…", kind: "pdf" as const, own: true, tier: 3 as const, score: 1 }];
    const r = await mergeSpecFindings(sql, profile, { is_same_company: true, products: [
      { product: "Ball valves", type: "ball", hs6_guess: null, sizes: "1/2 to 12 inch", pressure: "PN16, PN40", materials: "stainless steel 316", connections: "flanged", standards: null, evidence: [{ url: "https://spectest.example/catalogue.pdf", excerpt: "Ball valves 1/2 to 12 inch PN16/PN40 SS316" }] },
      { product: "Office chairs", type: null, hs6_guess: null, sizes: "all", pressure: null, materials: "steel", connections: null, standards: null, evidence: [] },
    ] }, run!.id, docs);
    expect(r).toEqual({ products: 2, attributed: 1, evidence: 1, created: 0 });
    const [c] = await sql<{ spec_attrs: Record<string, string>; audit_run_id: string | null; verdict: string }[]>`select spec_attrs, audit_run_id, verdict from capabilities where supplier_id = 'test:spec' and hs6 = '848180'`;
    expect(c!.spec_attrs).toEqual({ type: "ball", size: "1/2 to 12 inch", pressure: "PN16, PN40", material: "stainless steel 316", connection: "flanged" });
    expect(c!.audit_run_id).toBeNull();
    expect(c!.verdict).toBe("supported");
    const [e] = await sql<{ tier: number; source_type: string }[]>`select e.tier, e.source_type from evidence e join capabilities c on c.id = e.capability_id where c.supplier_id = 'test:spec'`;
    expect(e).toEqual({ tier: 3, source_type: "catalogue" });
    await sql`delete from suppliers where id = 'test:spec'`;
  });
});

describe("specPrompt", () => {
  test("tells the model that documents on the supplier's own site are the supplier's, whatever the brand name, and names the website", () => {
    const p = specPrompt(profile, [{ url: "https://bariqgroup.com/c.pdf", title: "c.pdf", snippet: "", text: "Ball valves PN16", kind: "pdf", own: true, tier: 3, score: 1 }]);
    expect(p.system).toMatch(/own (web)?site[^.]*belong/i);
    expect(p.human).toContain("Website on record: https://bariqgroup.com");
    expect(p.human).toContain("(supplier's own site)");
  });
});

describe("pickCatalogueLinks", () => {
  test("keeps same-host PDFs and catalogue, datasheet, download or brochure pages, PDFs first, at most max, never pages already read", () => {
    const links = [
      "https://bariqgroup.com/about", "https://bariqgroup.com/downloads/valve-catalogue.pdf", "https://bariqgroup.com/products/ball-valves",
      "https://cdn.other.example/brochure.pdf", "https://bariqgroup.com/datasheets/ball-valve-l400", "https://bariqgroup.com/en/downloads",
      "https://bariqgroup.com/products/ball-valves", "https://bariqgroup.com/careers",
    ];
    const picked = pickCatalogueLinks(links, ["bariqgroup.com"], new Set(["https://bariqgroup.com/products/ball-valves"]), 3);
    expect(picked).toEqual(["https://bariqgroup.com/downloads/valve-catalogue.pdf", "https://bariqgroup.com/datasheets/ball-valve-l400", "https://bariqgroup.com/en/downloads"]);
  });
});
