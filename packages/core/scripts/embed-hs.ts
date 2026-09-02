import { sql } from "../src/db/client";
import { hsEmbeddingText, toVectorLiteral } from "../src/hs/search";
import { getEmbeddings } from "../src/models/registry";

const embeddings = getEmbeddings();
const rows = await sql<{ code: string; title_en: string; title_ar: string; parent_title_en: string | null }[]>`
  select c.code, c.title_en, c.title_ar, p.title_en as parent_title_en
  from hs_codes c left join hs_codes p on p.code = c.parent_code
  where c.level in (4, 6) and c.embedding is null
  order by c.code`;
console.log(`to embed: ${rows.length}`);
const BATCH = 64;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const vectors = await embeddings.embedDocuments(chunk.map((r) => hsEmbeddingText({ title_en: r.title_en, title_ar: r.title_ar, parentTitleEn: r.parent_title_en })));
  await sql.begin(async (tx) => {
    for (let j = 0; j < chunk.length; j++) {
      await tx`update hs_codes set embedding = ${toVectorLiteral(vectors[j]!)}::vector where code = ${chunk[j]!.code}`;
    }
  });
  console.log(`embedded ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
}
await sql.end();
