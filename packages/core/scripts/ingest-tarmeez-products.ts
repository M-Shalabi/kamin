import { sql } from "../src/db/client";
import { TarmeezClient, type ProductListItem } from "../src/tarmeez/client";
import { loadProductList } from "../src/tarmeez/load";

const client = new TarmeezClient();
let batch: ProductListItem[] = [];
let total = 0;
for await (const item of client.listProducts()) {
  batch.push(item);
  if (batch.length === 2000) { total += await loadProductList(sql, batch); batch = []; console.log(`products loaded: ${total}`); }
}
if (batch.length) total += await loadProductList(sql, batch);
const [row] = await sql<{ n: number }[]>`select count(*)::int as n from products`;
console.log(`done. distinct tariff codes in db: ${row!.n}`);
await sql.end();
