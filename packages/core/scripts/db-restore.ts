/** Restores a snapshot written by db:snapshot into a fresh database. Drops and recreates the public schema first. */
const file = process.argv[2];
if (!file) { console.error("usage: bun run db:restore <snapshot.sql.gz>"); process.exit(1); }
if (!(await Bun.file(file).exists())) { console.error(`no such file: ${file}`); process.exit(1); }
const run = async (cmd: string) => { const p = Bun.spawn(["sh", "-c", cmd], { stdout: "inherit", stderr: "inherit" }); if ((await p.exited) !== 0) throw new Error(`failed: ${cmd}`); };
await run(`docker exec kamin-db psql -U kamin -d kamin -q -c "drop schema public cascade; create schema public; create extension if not exists vector;"`);
await run(`gunzip -c "${file}" | docker exec -i kamin-db psql -U kamin -d kamin -q -v ON_ERROR_STOP=1`);
console.log(`restored ${file}`);

export {};
