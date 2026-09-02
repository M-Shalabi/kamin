/**
 * LCGPA Local Content Score Template, Baseline (Template No. N.1), guideline G1 version 5.0 (15 November 2022).
 * The entity-level score is the share of an entity's total costs that stayed in the Kingdom in the last fiscal year:
 * Saudi employee compensation, goods and services bought from local suppliers, depreciation of locally sourced assets,
 * and capability-building spend (training, R&D, supplier development). This function computes exactly that ratio from
 * declared inputs and refuses to guess: any missing input yields null.
 */
export type G1Inputs = { saudi_salaries: number; local_goods_services: number; local_assets_depreciation: number; capability_building: number; total_costs: number };
const KEYS: (keyof G1Inputs)[] = ["saudi_salaries", "local_goods_services", "local_assets_depreciation", "capability_building", "total_costs"];

export function g1Score(inputs: Partial<G1Inputs>): { score: number; template: "G1 Baseline N.1"; components: Record<string, number> } | null {
  for (const k of KEYS) if (typeof inputs[k] !== "number" || !Number.isFinite(inputs[k]!)) return null;
  const i = inputs as G1Inputs;
  if (i.total_costs <= 0) return null;
  const components = {
    saudi_salaries: i.saudi_salaries / i.total_costs,
    local_goods_services: i.local_goods_services / i.total_costs,
    local_assets_depreciation: i.local_assets_depreciation / i.total_costs,
    capability_building: i.capability_building / i.total_costs,
  };
  const score = Object.values(components).reduce((s, v) => s + v, 0);
  return { score: Number(score.toFixed(6)), template: "G1 Baseline N.1", components: Object.fromEntries(Object.entries(components).map(([k, v]) => [k, Number(v.toFixed(6))])) };
}
