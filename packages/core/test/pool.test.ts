import { describe, expect, test } from "bun:test";
import { compatible, poolLines, specEnvelope } from "../src/coordinator/pool";
import { NormalizedSpec, type NormalizedSpecT } from "../src/coordinator/schema";

const base = (over: Partial<NormalizedSpecT>): NormalizedSpecT => NormalizedSpec.parse({
  object_class: "ball valve", object_family: "valve", size_inch: 2, size_dn: 50, pressure_bar: 40, pressure_class: null,
  material: "stainless_steel", material_grade: null, connection: null, standard: null, quantity: 12, quantity_unit: "pcs",
  extra_attrs: [], english_description: "2 inch stainless steel ball valve 40 bar", source_language: "en", ...over,
});

describe("pooling", () => {
  const a = base({});
  const b = base({ material_grade: "316", size_inch: null, size_dn: 50, quantity: 40 });
  const c = base({ pressure_bar: null, quantity: 5 });

  test("the three-line scenario pools into one order with the tightest envelope", () => {
    expect(compatible(a, b)).toBe(true);
    expect(compatible(a, c)).toBe(true);
    const env = specEnvelope([a, b, c]);
    expect(env).toMatchObject({ object_class: "ball valve", size_inch: 2, size_dn: 50, pressure_bar: 40, material: "stainless_steel", material_grade: "316" });
    const pooled = poolLines([
      { id: "A", portco: "Ma'aden", hs6: "848180", spec: a, quantity: 12 },
      { id: "B", portco: "ACWA Power", hs6: "848180", spec: b, quantity: 40 },
      { id: "C", portco: "SEC", hs6: "848180", spec: c, quantity: 5 },
    ]);
    expect(pooled).toHaveLength(1);
    expect(pooled[0]).toMatchObject({ hs6: "848180", lineIds: ["A", "B", "C"], portcos: ["Ma'aden", "ACWA Power", "SEC"], qty_now: 57 });
  });

  test("different sizes do not pool", () => {
    expect(compatible(a, base({ size_inch: 4, size_dn: 100 }))).toBe(false);
  });

  test("different object classes do not pool even under one hs6", () => {
    expect(compatible(a, base({ object_class: "gate valve" }))).toBe(false);
  });

  test("conflicting grades do not pool, a missing grade does", () => {
    expect(compatible(base({ material_grade: "304" }), base({ material_grade: "316" }))).toBe(false);
    expect(compatible(base({ material_grade: null }), base({ material_grade: "316" }))).toBe(true);
  });

  test("a stricter pressure rating tightens the envelope rather than splitting", () => {
    const env = specEnvelope([base({ pressure_bar: 16 }), base({ pressure_bar: 40 })]);
    expect(env.pressure_bar).toBe(40);
  });
});
