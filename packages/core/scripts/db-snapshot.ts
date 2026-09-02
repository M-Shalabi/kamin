import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { REPO_ROOT } from "../src/paths";

/** Freezes the whole graph (suppliers, capabilities, evidence, runs, demand, matches) into data/snapshots/. */
const dir = join(REPO_ROOT, "data/snapshots");
await mkdir(dir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const file = process.argv[2] ?? join(dir, `kamin-${stamp}.sql.gz`);
const proc = Bun.spawn(["sh", "-c", `docker exec kamin-db pg_dump -U kamin -d kamin --no-owner --no-privileges | gzip > "${file}"`], { stdout: "inherit", stderr: "inherit" });
if ((await proc.exited) !== 0) throw new Error("pg_dump failed");
const size = (await Bun.file(file).size) / 1e6;
console.log(`snapshot written: ${file} (${size.toFixed(1)} MB)`);
