import { sql } from "../src/db/client";
import { runCoordinator } from "../src/coordinator/run";

const rawText = process.argv.slice(2).join(" ");
if (!rawText) { console.error("usage: bun run coordinator <purchase request line>"); process.exit(1); }
const r = await runCoordinator(sql, { rawText, portco: "cli" });
console.log("\nnormalised:", JSON.stringify(r.normalized, null, 2));
console.log(`hs6: ${r.hs6} (confidence ${r.confidence}) because ${r.reasoning}`);
await sql.end();
