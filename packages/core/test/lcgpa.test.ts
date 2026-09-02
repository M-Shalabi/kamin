import { describe, expect, test } from "bun:test";
import { g1Score } from "../src/lcgpa/g1";

describe("g1Score", () => {
  test("computes the entity-level share of local value over total costs", () => {
    const r = g1Score({ saudi_salaries: 30, local_goods_services: 40, local_assets_depreciation: 10, capability_building: 5, total_costs: 200 });
    expect(r).not.toBeNull();
    expect(r!.score).toBeCloseTo(0.425, 6);
    expect(r!.template).toBe("G1 Baseline N.1");
    expect(r!.components).toEqual({ saudi_salaries: 0.15, local_goods_services: 0.2, local_assets_depreciation: 0.05, capability_building: 0.025 });
  });
  test("is input-gated: any missing input or zero total gives null", () => {
    expect(g1Score({ saudi_salaries: 30, total_costs: 200 })).toBeNull();
    expect(g1Score({ saudi_salaries: 30, local_goods_services: 40, local_assets_depreciation: 10, capability_building: 5, total_costs: 0 })).toBeNull();
  });
});
