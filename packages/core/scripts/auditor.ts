import { sql } from "../src/db/client";
import { runAuditor } from "../src/auditor/run";

const id = process.argv[2];
if (!id) { console.error("usage: bun run auditor <capabilityId>"); process.exit(1); }
console.log(await runAuditor(sql, id));
await sql.end();
