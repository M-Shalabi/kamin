import { describe, expect, test } from "bun:test";
import { nameSimilarity, normaliseArabic } from "../src/text/names";

describe("names", () => {
  test("normaliseArabic unifies forms and drops boilerplate", () => {
    expect(normaliseArabic("شركة أماد الصناعيّة المحدودة")).toBe("اماد الصناعيه");
    expect(normaliseArabic("مصنع الخليج للصمامات")).toBe("الخليج للصمامات");
  });
  test("nameSimilarity is high for the same company across spellings and low for strangers", () => {
    expect(nameSimilarity("شركة اماد الصناعية", "شركة أماد الصناعيه المحدودة")).toBeGreaterThanOrEqual(0.9);
    expect(nameSimilarity("Yusuf Bin Ahmed Kanoo Pumps and Valves Factory", "sharikat yusuf bin ahmad kano lilsamamat walmadkhat Factory")).toBeGreaterThanOrEqual(0.3);
    expect(nameSimilarity("شركة اماد الصناعية", "مصنع الخليج للصمامات")).toBeLessThan(0.2);
  });
});
