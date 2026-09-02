import { sql } from "../src/db/client";
import { fetchImports, loadImports, sectorSubheadings } from "../src/comtrade/ingest";

const codes = await sectorSubheadings(sql, ["8481", "8413", "7307", "7412"]);
const rows = await fetchImports(codes);
console.log(`imports loaded: ${await loadImports(sql, rows)} of ${codes.length} subheadings; total USD bn ${(rows.reduce((s, r) => s + r.value_usd, 0) / 1e9).toFixed(2)}`);
await sql.end();
