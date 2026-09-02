import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "../src/db/client";
import { extractMembers, loadMembers } from "../src/madeinsaudi/load";

import { REPO_ROOT } from "../src/paths";
const file = join(REPO_ROOT, "data/raw/saudimade/members.json");
const members = extractMembers(JSON.parse(await readFile(file, "utf8")) as unknown[]);
console.log(`members extracted: ${members.length}, with CR: ${members.filter((m) => m.cr_number).length}`);
console.log(await loadMembers(sql, members));
await sql.end();
