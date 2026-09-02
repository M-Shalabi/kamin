import { sql } from "../src/db/client";
import { TarmeezClient } from "../src/tarmeez/client";

type Mining = { Id: number; CompanyName: { Ar: string; En: string }; Website: string | null; Mobile: string | null; Email: string | null };
const client = new TarmeezClient();
const page = await client.fetchJson<{ TotalCount: number; Items: Mining[] }>("/mining/companies?pageIndex=1&pageSize=200");
for (const m of page.Items) {
  await sql`insert into mining_companies (id, name_ar, name_en, website, email, mobile, raw) values (${m.Id}, ${m.CompanyName?.Ar?.trim() ?? null}, ${m.CompanyName?.En?.trim() ?? null}, ${m.Website?.trim() ?? null}, ${m.Email?.trim() ?? null}, ${m.Mobile?.trim() ?? null}, ${sql.json(m as never)})
    on conflict (id) do update set name_ar = excluded.name_ar, name_en = excluded.name_en, website = excluded.website, email = excluded.email, mobile = excluded.mobile, raw = excluded.raw`;
}
console.log(`mining companies: ${page.Items.length}`);
await sql.end();
