import { describe, expect, test } from "bun:test";
import { canonConnection, canonMaterial, canonicalize, dnToInch, inchToDn, parsePressureToken, parseSizeToken } from "../src/coordinator/units";
import { NormalizedSpec } from "../src/coordinator/schema";

describe("sizes", () => {
  test("inch and DN map both ways", () => {
    expect(inchToDn(2)).toBe(50);
    expect(inchToDn(0.5)).toBe(15);
    expect(dnToInch(100)).toBe(4);
    expect(inchToDn(7)).toBeNull();
  });
  test("parseSizeToken reads inch marks, DN and arabic digits", () => {
    expect(parseSizeToken('2"')).toEqual({ inch: 2, dn: 50 });
    expect(parseSizeToken("2IN")).toEqual({ inch: 2, dn: 50 });
    expect(parseSizeToken("DN50")).toEqual({ inch: 2, dn: 50 });
    expect(parseSizeToken("٢ بوصة")).toEqual({ inch: 2, dn: 50 });
    expect(parseSizeToken("1/2 in")).toEqual({ inch: 0.5, dn: 15 });
    expect(parseSizeToken("3/4\"")).toEqual({ inch: 0.75, dn: 20 });
    expect(parseSizeToken("banana")).toBeNull();
  });
});

describe("pressure", () => {
  test("PN, bar, psi and class tokens", () => {
    expect(parsePressureToken("PN16")).toEqual({ bar: 16, klass: null });
    expect(parsePressureToken("٤٠ بار")).toEqual({ bar: 40, klass: null });
    expect(parsePressureToken("40 bar")).toEqual({ bar: 40, klass: null });
    expect(parsePressureToken("232 psi")?.bar).toBeCloseTo(16, 0);
    expect(parsePressureToken("CL150")).toEqual({ bar: null, klass: "150" });
    expect(parsePressureToken("150#")).toEqual({ bar: null, klass: "150" });
    expect(parsePressureToken("Class 300")).toEqual({ bar: null, klass: "300" });
  });
});

describe("materials and connections", () => {
  test("arabic and english material tokens canonicalise", () => {
    expect(canonMaterial("SS316")).toBe("stainless_steel");
    expect(canonMaterial("الفولاذ المقاوم للصدأ")).toBe("stainless_steel");
    expect(canonMaterial("ستانلس ستيل")).toBe("stainless_steel");
    expect(canonMaterial("CI")).toBe("cast_iron");
    expect(canonMaterial("حديد زهر مطاوع")).toBe("ductile_iron");
    expect(canonMaterial("نحاس")).toBe("brass");
    expect(canonMaterial("CS")).toBe("carbon_steel");
    expect(canonMaterial("PVDF")).toBe("pvdf");
    expect(canonMaterial("wood")).toBeNull();
  });
  test("connection tokens canonicalise", () => {
    expect(canonConnection("FLGD")).toBe("flanged");
    expect(canonConnection("بشفة")).toBe("flanged");
    expect(canonConnection("NPT")).toBe("threaded");
    expect(canonConnection("ملولب")).toBe("threaded");
    expect(canonConnection("BW")).toBe("butt_weld");
    expect(canonConnection("لحام تناكبي")).toBe("butt_weld");
    expect(canonConnection("wafer")).toBe("wafer");
  });
});

describe("canonicalize", () => {
  test("fills the missing size unit and reads PN from extra attrs", () => {
    const spec = NormalizedSpec.parse({
      object_class: "gate valve", object_family: "valve", size_inch: null, size_dn: 100, pressure_bar: null, pressure_class: null,
      material: "cast_iron", material_grade: null, connection: "flanged", standard: null, quantity: null, quantity_unit: null,
      extra_attrs: [{ key: "pressure_rating", value: "PN16" }], english_description: "cast iron gate valve DN100 PN16 flanged", source_language: "ar",
    });
    const c = canonicalize(spec);
    expect(c.size_inch).toBe(4);
    expect(c.pressure_bar).toBe(16);
  });
  test("normalises the material grade", () => {
    const spec = NormalizedSpec.parse({
      object_class: "elbow", object_family: "fitting", size_inch: 2, size_dn: null, pressure_bar: null, pressure_class: null,
      material: "stainless_steel", material_grade: "ss 316 l", connection: "butt_weld", standard: "ASTM A403", quantity: null, quantity_unit: null,
      extra_attrs: [], english_description: "90 degree butt weld elbow 2 inch SS316L", source_language: "en",
    });
    expect(canonicalize(spec).material_grade).toBe("316L");
    expect(canonicalize(spec).size_dn).toBe(50);
  });
});

describe("canonConnection on flange types", () => {
  test("a weld neck flange is butt welded to the pipe", async () => {
    const { canonConnection } = await import("../src/coordinator/units");
    expect(canonConnection("Weld neck")).toBe("butt_weld");
    expect(canonConnection("WN RF")).toBe("butt_weld");
  });
});
