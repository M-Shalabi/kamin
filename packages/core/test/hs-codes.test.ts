import { describe, expect, test } from "bun:test";
import { flattenCategories, hsLevel, tariffToHs6 } from "../src/hs/codes";
import sample from "./fixtures/tarmeez-categories-sample.json";

describe("hs codes", () => {
  test("tariffToHs6 takes the first six digits of 10 and 12 digit tariff codes", () => {
    expect(tariffToHs6("8481300005")).toBe("848130");
    expect(tariffToHs6("841581000000")).toBe("841581");
    expect(tariffToHs6("848180")).toBe("848180");
  });

  test("tariffToHs6 rejects non-numeric or short input", () => {
    expect(() => tariffToHs6("84-81")).toThrow();
    expect(() => tariffToHs6("8481")).toThrow();
  });

  test("hsLevel reads the symbol shape", () => {
    expect(hsLevel("01-05")).toBe(0);
    expect(hsLevel("01")).toBe(2);
    expect(hsLevel("0101")).toBe(4);
    expect(hsLevel("010100")).toBe(6);
  });

  test("flattenCategories yields one row per node with parent links", () => {
    const rows = flattenCategories(sample.Items);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({ code: "01-05", level: 0, parent_code: null, title_ar: "حيوانات حية ومنتجات المملكة الحيوانية", title_en: "Live Animals; Animal Products" });
    expect(rows[3]).toEqual({ code: "010100", level: 6, parent_code: "0101", title_ar: "خيول وحمير وبغال و كوادن (نغال)، حيه", title_en: "Horses, asses, mules and hinnies; live" });
  });
});
