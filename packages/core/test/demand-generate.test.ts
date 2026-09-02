import { describe, expect, test } from "bun:test";
import { generateDemand, PORTFOLIO_IMPORT_SHARE } from "../src/demand/generate";

const imports = [{ hs6: "848180", value_usd: 1_000_000 }, { hs6: "841370", value_usd: 500_000 }, { hs6: "730723", value_usd: 100_000 }];

describe("generateDemand", () => {
  test("is deterministic for a seed and different across seeds", () => {
    const a = generateDemand(7, imports, { lines: 24 });
    const b = generateDemand(7, imports, { lines: 24 });
    const c = generateDemand(8, imports, { lines: 24 });
    expect(a).toEqual(b);
    expect(a.map((l) => l.raw_text)).not.toEqual(c.map((l) => l.raw_text));
    expect(a).toHaveLength(24);
  });
  test("anchors annual values to the import value times the portfolio share, per subheading", () => {
    const lines = generateDemand(1, imports, { lines: 60 });
    for (const imp of imports) {
      const sum = lines.filter((l) => l.seed_hs6 === imp.hs6).reduce((s, l) => s + l.annual_value_usd, 0);
      expect(Math.abs(sum - imp.value_usd * PORTFOLIO_IMPORT_SHARE)).toBeLessThan(1);
    }
  });
  test("uses several surface formats, real portco names and unique keys", () => {
    const lines = generateDemand(3, imports, { lines: 60 });
    expect(new Set(lines.map((l) => l.line_key)).size).toBe(60);
    expect(lines.some((l) => /[؀-ۿ]/.test(l.raw_text))).toBe(true);
    expect(lines.some((l) => /[٠-٩]/.test(l.raw_text))).toBe(true);
    expect(lines.some((l) => /VLV|PMP|FLG|ELB/.test(l.raw_text))).toBe(true);
    expect(lines.every((l) => l.portco.length > 2 && l.qty > 0 && l.history_factor >= 1)).toBe(true);
  });
});
