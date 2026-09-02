import { sql } from "../src/db/client";

const rows = [
  { hs4: "8481", label_en: "Valves", label_ar: "الصمامات", effective_from: "2027-08-01", source_url: "https://www.spa.gov.sa/en/N2514218", note: "Announced tranche subject to a minimum local-content percentage from 1 August 2027" },
  { hs4: "8413", label_en: "Water pumps", label_ar: "مضخات المياه", effective_from: "2027-08-01", source_url: "https://www.spa.gov.sa/en/N2514218", note: "Announced tranche" },
  { hs4: "7408", label_en: "Copper wire", label_ar: "أسلاك النحاس", effective_from: "2027-08-01", source_url: "https://www.spa.gov.sa/en/N2514218", note: "Announced tranche" },
  { hs4: "8415", label_en: "Split air conditioners", label_ar: "مكيفات السبليت", effective_from: "2027-08-01", source_url: "https://www.spa.gov.sa/en/N2514218", note: "Announced tranche" },
  { hs4: "9018", label_en: "Medical devices", label_ar: "الأجهزة الطبية", effective_from: "2027-08-01", source_url: "https://www.spa.gov.sa/en/N2514218", note: "Announced tranche" },
];
for (const r of rows) await sql`insert into mandatory_list ${sql(r)} on conflict (hs4) do update set label_en = excluded.label_en, label_ar = excluded.label_ar, effective_from = excluded.effective_from, source_url = excluded.source_url, note = excluded.note`;
console.log(`mandatory list seeded: ${rows.length} headings`);
await sql.end();
