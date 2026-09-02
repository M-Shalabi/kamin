import { sql } from "../src/db/client";
import { matchAll } from "../src/match/persist";
console.log(await matchAll(sql));
await sql.end();
