import { sql } from "../src/db/client";
import { flattenCategories } from "../src/hs/codes";
import { TarmeezClient } from "../src/tarmeez/client";

const client = new TarmeezClient();
const rows = flattenCategories(await client.categories());
console.log(`hs tree: ${rows.length} nodes`);
for (let i = 0; i < rows.length; i += 500) {
  const chunk = rows.slice(i, i + 500);
  await sql`
    insert into hs_codes ${sql(chunk, "code", "level", "parent_code", "title_ar", "title_en")}
    on conflict (code) do update set title_ar = excluded.title_ar, title_en = excluded.title_en, parent_code = excluded.parent_code, level = excluded.level`;
}
const [row] = await sql<{ n: number }[]>`select count(*)::int as n from hs_codes where level = 6`;
console.log(`level-6 codes in db: ${row!.n}`);
await sql.end();
