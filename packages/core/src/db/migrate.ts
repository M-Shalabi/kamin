import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Sql } from "postgres";

const dir = join(import.meta.dir, "migrations");

export async function migrate(db: Sql): Promise<string[]> {
  await db`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const done = new Set((await db<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const body = await readFile(join(dir, file), "utf8");
    await db.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    applied.push(file);
  }
  return applied;
}

if (import.meta.main) {
  const { sql } = await import("./client");
  const applied = await migrate(sql);
  console.log(applied.length ? `applied: ${applied.join(", ")}` : "nothing to apply");
  await sql.end();
}
