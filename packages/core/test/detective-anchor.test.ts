import { describe, expect, test } from "bun:test";
import { anchorFinding, evidenceTier, productTokens } from "../src/detective/anchor";

const declared = [
  { hs6: "848100", title_en: "Taps- cocks- valves and similar appliances for pipes" },
  { hs6: "848130", title_en: "Check valves" },
  { hs6: "848110", title_en: "Pressure-reducing valves" },
  { hs6: "848140", title_en: "Safety or relief valves" },
];

describe("productTokens", () => {
  test("lowercases, singularises, drops model codes and filler", () => {
    expect(productTokens("Swing Check Valves (Bronze)")).toEqual(["swing", "check", "valve", "bronze"]);
    expect(productTokens("Gate Valves (Model B7000)")).toEqual(["gate", "valve"]);
  });
});

describe("anchorFinding", () => {
  test("attaches to the declared capability whose distinguishing words the finding contains", () => {
    expect(anchorFinding("Swing Check Valves (Bronze)", declared)).toEqual({ hs6: "848130", via: "declared" });
    expect(anchorFinding("Pressure Independent Control Valves (BRQ-9000)", declared)).toEqual({ hs6: "848180", via: "keyword" });
    expect(anchorFinding("Pressure reducing valve DN50", declared)).toEqual({ hs6: "848110", via: "declared" });
  });
  test("falls back to the sector keyword table when no declared line fits", () => {
    expect(anchorFinding("Gate Valves (Model B7000)", declared)).toEqual({ hs6: "848180", via: "keyword" });
    expect(anchorFinding("Submersible centrifugal pumps", [])).toEqual({ hs6: "841370", via: "keyword" });
    expect(anchorFinding("Butt weld elbows, carbon steel", [])).toEqual({ hs6: "730793", via: "keyword" });
    expect(anchorFinding("Stainless steel weld neck flanges", [])).toEqual({ hs6: "730721", via: "keyword" });
  });
  test("prefers the generic declared valve line over a wrong specific one", () => {
    expect(anchorFinding("Ball Valves (Model L400)", declared)).toEqual({ hs6: "848180", via: "keyword" });
    expect(anchorFinding("Valves (General)", declared)).toEqual({ hs6: "848100", via: "declared" });
  });
  test("returns null outside the sector", () => {
    expect(anchorFinding("Y-Type Strainers (Model 5000)", declared)).toBeNull();
    expect(anchorFinding("Office furniture", [])).toBeNull();
  });
  test("keeps a valid model guess, except when the keyword table knows the type within the same heading", () => {
    expect(anchorFinding("anything", declared, "848180")).toEqual({ hs6: "848180", via: "model" });
    expect(anchorFinding("Cast Iron Globe Valve", [], "848120")).toEqual({ hs6: "848180", via: "keyword" });
    expect(anchorFinding("Y strainer", [], "842129")).toEqual({ hs6: "842129", via: "model" });
    expect(anchorFinding("Check valves", declared, "8481")).toEqual({ hs6: "848130", via: "declared" });
  });
});

describe("evidenceTier", () => {
  const own = ["bariqgroup.com"];
  test("self-published pages are Tier 3 whatever the kind, even certifications", () => {
    expect(evidenceTier("https://www.bariqgroup.com/certificates", "certification", own, 3)).toBe(3);
    expect(evidenceTier("https://bariqgroup.com/products/valves", "catalogue", own, 3)).toBe(3);
  });
  test("the host decides: a certifier or registry host gives its tier, an unknown or social host never beats Tier 3", () => {
    expect(evidenceTier("https://saso.gov.sa/cert/123", "certification", own, 1)).toBe(1);
    expect(evidenceTier("https://lc.mcci.org.sa/Home/FactoryDetails/1", "registry", own, 2)).toBe(2);
    expect(evidenceTier("https://sa.linkedin.com/company/x", "certification", own, 3)).toBe(3);
    expect(evidenceTier("https://news.example.com/a", "award", own, 3)).toBe(3);
  });
  test("a recognised host keeps its tier even when the model labels the kind loosely", () => {
    expect(evidenceTier("https://madeinsaudi.sa/members/9", "website", own, 1)).toBe(1);
    expect(evidenceTier("https://directory.example.com/x", "website", own, 2)).toBe(2);
  });
});
