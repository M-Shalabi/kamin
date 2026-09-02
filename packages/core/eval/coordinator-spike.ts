import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "../src/db/client";
import { poolLines } from "../src/coordinator/pool";
import { runCoordinator } from "../src/coordinator/run";
import { modelRefFor } from "../src/models/registry";
import lines from "./demand-lines.json";

type Line = (typeof lines)[number];
const model = modelRefFor("coordinator");
const started = Date.now();
const results: { id: string; raw: string; hs6: string | null; expected: string[]; hs6_ok: boolean; attr_hits: number; attr_total: number; confidence: number | null; ms: number; error?: string; normalized?: unknown }[] = [];
const pooled: Parameters<typeof poolLines>[0] = [];

for (const line of lines as Line[]) {
  const t = Date.now();
  try {
    const r = await runCoordinator(sql, { rawText: line.raw, portco: line.portco, sourceSystem: line.system });
    const attrs = Object.entries(line.expect.attrs);
    const hits = attrs.filter(([k, v]) => (r.normalized as Record<string, unknown>)[k] === v).length;
    results.push({ id: line.id, raw: line.raw, hs6: r.hs6, expected: line.expect.hs6, hs6_ok: line.expect.hs6.includes(r.hs6), attr_hits: hits, attr_total: attrs.length, confidence: r.confidence, ms: Date.now() - t, normalized: r.normalized });
    pooled.push({ id: line.id, portco: line.portco, hs6: r.hs6, spec: r.normalized, quantity: line.qty });
  } catch (err) {
    results.push({ id: line.id, raw: line.raw, hs6: null, expected: line.expect.hs6, hs6_ok: false, attr_hits: 0, attr_total: Object.keys(line.expect.attrs).length, confidence: null, ms: Date.now() - t, error: (err as Error).message });
  }
}

const orders = poolLines(pooled);
const summary = {
  model,
  hs6_correct: results.filter((r) => r.hs6_ok).length,
  total: results.length,
  attribute_score: Number((results.reduce((s, r) => s + r.attr_hits, 0) / results.reduce((s, r) => s + r.attr_total, 0)).toFixed(3)),
  pooled_orders: orders.length,
  pooled_groups: orders.map((o) => ({ hs6: o.hs6, lines: o.lineIds, qty_now: o.qty_now })),
  elapsed_ms: Date.now() - started,
};

console.log("\nid   ok  predicted  expected        attrs  ms");
for (const r of results) console.log(`${r.id}  ${r.hs6_ok ? "✓ " : "✗ "}  ${r.hs6 ?? "-"}     ${r.expected.join("/")}  ${r.attr_hits}/${r.attr_total}    ${r.ms}${r.error ? "  " + r.error : ""}`);
console.log(`\n${summary.hs6_correct}/${summary.total} hs6 correct, attribute score ${summary.attribute_score}, ${summary.pooled_orders} pooled orders from ${results.length} lines, model ${model}`);

const dir = join(import.meta.dir, "results");
await mkdir(dir, { recursive: true });
const file = join(dir, `${model.replace(/[^a-z0-9]+/gi, "_")}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
await writeFile(file, JSON.stringify({ summary, results }, null, 2));
console.log(`written ${file}`);
await sql.end();
