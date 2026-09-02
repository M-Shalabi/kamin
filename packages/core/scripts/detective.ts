import { sql } from "../src/db/client";
import { runDetective } from "../src/detective/run";

const id = process.argv[2];
if (!id) { console.error("usage: bun run detective <supplierId, e.g. tarmeez:41699>"); process.exit(1); }
const r = await runDetective(sql, id);
console.log("\nsummary:", r.findings.summary);
console.log("website:", r.findings.website, "| same company:", r.findings.is_same_company);
for (const c of r.findings.capabilities) console.log(`- ${c.product} [${c.hs6_guess ?? "?"}] ${c.class_guess} evidence ${c.evidence.length}`);
console.log("merged:", r.merged);
await sql.end();
