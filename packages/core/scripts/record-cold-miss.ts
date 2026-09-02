import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "../src/db/client";
import { coldMiss } from "../src/coldmiss";
import { REPO_ROOT } from "../src/paths";

const id = process.argv[2];
if (!id) { console.error("usage: bun run record-cold-miss <supplierId>"); process.exit(1); }
const t0 = Date.now();
const events: { t: number; line: string }[] = [];
await coldMiss(sql, id, (line) => { events.push({ t: Date.now() - t0, line }); console.log(line); });
const dir = join(REPO_ROOT, "apps/web/public/cold-miss");
await mkdir(dir, { recursive: true });
const file = join(dir, `${id}.json`);
await writeFile(file, JSON.stringify({ supplierId: id, recordedAt: new Date().toISOString(), events }, null, 1));
console.log(`recorded ${events.length} lines in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${file}`);
await sql.end();
