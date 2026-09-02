import { describe, expect, test } from "bun:test";
import { buildQueries, nameTokens } from "../src/detective/queries";
import { classifyUrl, selectPages } from "../src/detective/select";
import { DetectiveFindingsLoose } from "../src/detective/schema";
import type { SupplierProfile } from "../src/detective/queries";

const kanoo: SupplierProfile = {
  id: "tarmeez:41699", name_ar: "مصنع شركة يوسف بن أحمد كانو للصمامات والمضخات", name_en: "sharikat yusuf bin ahmad kano lilsamamat walmadkhat Factory",
  city_en: "AlJubail", region_en: "Eastern Region", website: null, cr_number: "2055024776",
  declared: [{ hs6: "848100", title_en: "Taps, cocks, valves and similar appliances for pipes", title_ar: "حنفيات وصنابير وصمامات", amount: 150, unit: "Ton" }],
};

describe("queries", () => {
  test("nameTokens drops legal boilerplate and transliteration noise", () => {
    expect(nameTokens(kanoo)).toEqual(expect.arrayContaining(["kano", "كانو", "للصمامات", "والمضخات"]));
    expect(nameTokens(kanoo)).not.toContain("شركة");
    expect(nameTokens(kanoo)).not.toContain("factory");
  });
  test("buildQueries makes one Arabic and one English query with the city and the product", () => {
    const q = buildQueries(kanoo);
    expect(q).toHaveLength(2);
    expect(q[0]).toContain("كانو");
    expect(q[0]).toContain("الجبيل");
    expect(q[1]).toMatch(/kano/i);
    expect(q[1]).toMatch(/valves/i);
    expect(q[1]).toMatch(/Saudi/);
  });
});

describe("classifyUrl", () => {
  test("recognises the supplier's own site, directories, certifications and social pages", () => {
    expect(classifyUrl("https://www.kanoo.com/ar/industrial", ["kanoo"])).toEqual({ kind: "own_site", tier: 3 });
    expect(classifyUrl("https://www.dnb.com/business-directory/company-profiles.kanoo.html", ["kanoo"])).toEqual({ kind: "directory", tier: 2 });
    expect(classifyUrl("https://sa.linkedin.com/company/ybakanoo", ["kanoo"])).toEqual({ kind: "directory", tier: 2 });
    expect(classifyUrl("https://saudimade.sa/en/members/kanoo", ["kanoo"])).toEqual({ kind: "certification", tier: 1 });
    expect(classifyUrl("https://www.instagram.com/p/xyz", ["kanoo"])).toEqual({ kind: "social", tier: 3 });
    expect(classifyUrl("https://www.arabnews.com/node/123", ["kanoo"])).toEqual({ kind: "news", tier: 3 });
  });
});

describe("selectPages", () => {
  test("keeps own site and directories first, drops social when better pages exist, caps the count", () => {
    const results = [
      { title: "Insta", url: "https://www.instagram.com/p/1", content: "post", raw_content: null, score: 0.7 },
      { title: "Kanoo", url: "https://www.kanoo.com/ar", content: "home", raw_content: "raw home", score: 0.4 },
      { title: "D&B", url: "https://www.dnb.com/business-directory/company-profiles.kanoo.html", content: "profile", raw_content: null, score: 0.8 },
      { title: "Machinery", url: "https://www.kanoomachinery.com/ksa", content: "equipment", raw_content: "raw eq", score: 0.5 },
      { title: "News", url: "https://www.arabnews.com/node/1", content: "news", raw_content: null, score: 0.3 },
    ];
    const pages = selectPages(kanoo, results, 3);
    expect(pages.map((p) => p.kind)).toEqual(["own_site", "own_site", "directory"]);
    expect(pages.some((p) => p.kind === "social")).toBe(false);
  });
});

describe("DetectiveFindingsLoose", () => {
  test("coerces a sloppy model reply into findings", () => {
    const f = DetectiveFindingsLoose.parse({
      website: "kanoo.com", is_same_company: "true",
      capabilities: [{ product: "Ball valves", hs6_guess: "8481.80", class_guess: "manufacturer", spec_attrs: { size: "2 inch" }, evidence: [{ url: "https://kanoo.com/p", excerpt: "x", kind: "catalogue" }] }],
      certifications: [{ name: "ISO 9001", url: "https://kanoo.com/iso" }],
      signals: { employees: 120 }, summary: "s",
    });
    expect(f.website).toBe("https://kanoo.com");
    expect(f.is_same_company).toBe(true);
    expect(f.capabilities[0]!.hs6_guess).toBe("848180");
    expect(f.capabilities[0]!.spec_attrs).toEqual([{ key: "size", value: "2 inch" }]);
    expect(f.certifications[0]!.excerpt).toBe("");
    expect(f.signals.employees).toBe("120");
  });
});

describe("DetectiveFindingsLoose with stringified arrays", () => {
  test("parses capabilities and evidence handed over as JSON strings instead of dropping them", async () => {
    const { DetectiveFindingsLoose } = await import("../src/detective/schema");
    const r = DetectiveFindingsLoose.parse({
      website: "https://bariqgroup.com", is_same_company: "true",
      capabilities: '[{"class_guess": "manufacturer", "hs6_guess": null, "product": "Ball valves (PN16)", "spec_attrs": [], "evidence": [{"url": "https://bariqgroup.com/valves", "excerpt": "BRONZE BALL VALVE PN16", "kind": "catalogue"}]}]',
      certifications: "[]", signals: '{"employees": null, "capacity": "2500 t", "facility": null}', summary: "s",
    });
    expect(r.capabilities).toHaveLength(1);
    expect(r.capabilities[0]!.evidence[0]!.url).toBe("https://bariqgroup.com/valves");
    expect(r.signals.capacity).toBe("2500 t");
  });
});
