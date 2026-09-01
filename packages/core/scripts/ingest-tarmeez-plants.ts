import pLimit from "p-limit";
import { sql } from "../src/db/client";
import { TarmeezClient } from "../src/tarmeez/client";
import { loadPlant } from "../src/tarmeez/load";
import { mapPlant } from "../src/tarmeez/map";

const client = new TarmeezClient({ concurrency: 4, delayMs: 200 });
const only = process.argv[2] ? Number(process.argv[2]) : null;
const ids: number[] = [];
for await (const p of client.listPlants()) { ids.push(p.Id); if (only && ids.length >= only) break; }
console.log(`plants to fetch: ${ids.length}`);

const done = new Set((await sql<{ tarmeez_id: number }[]>`select tarmeez_id from suppliers where source = 'tarmeez' and raw is not null`).map((r) => r.tarmeez_id));
const todo = ids.filter((id) => !done.has(id));
console.log(`already loaded: ${done.size}, remaining: ${todo.length}`);

const limit = pLimit(4);
let n = 0, failed = 0;
await Promise.all(todo.map((id) => limit(async () => {
  try {
    const detail = await client.plantDetail(id);
    await loadPlant(sql, mapPlant(detail));
    n++;
    if (n % 200 === 0) console.log(`loaded ${n}/${todo.length}`);
  } catch (err) {
    failed++;
    console.error(`plant ${id} failed: ${(err as Error).message}`);
  }
})));
const [s] = await sql<{ suppliers: number }[]>`select count(*)::int as suppliers from suppliers where in_tarmeez`;
const [c] = await sql<{ caps: number }[]>`select count(*)::int as caps from capabilities`;
console.log(`done. loaded ${n}, failed ${failed}. suppliers=${s!.suppliers} capabilities=${c!.caps}`);
await sql.end();
