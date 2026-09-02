export const PORTFOLIO_IMPORT_SHARE = 0.12;

export const PORTCOS: { name: string; systems: string[] }[] = [
  { name: "Ma'aden", systems: ["SAP MM", "SAP Ariba"] },
  { name: "ACWA Power", systems: ["Oracle iProc", "Excel"] },
  { name: "Saudi Electricity Company", systems: ["SAP MM"] },
  { name: "NEOM", systems: ["Oracle Fusion", "Excel"] },
  { name: "SABIC", systems: ["SAP Ariba"] },
  { name: "Marafiq", systems: ["SAP MM", "Excel"] },
  { name: "SIRC", systems: ["Oracle iProc"] },
  { name: "Red Sea Global", systems: ["Oracle Fusion"] },
  { name: "ROSHN", systems: ["Excel", "SAP MM"] },
  { name: "Qiddiya", systems: ["Oracle iProc"] },
  { name: "Bahri", systems: ["SAP MM"] },
  { name: "Saudi Aramco", systems: ["SAP MM", "SAP Ariba"] },
];

export type DemandSeed = { line_key: string; portco: string; source_system: string; raw_text: string; qty: number; qty_unit: string; history_factor: number; seed_hs6: string; annual_value_usd: number };

type Mat = { ar: string; en: string; abbr: string };
type Pick = { size: string; sizeDn: string; sizeAr: string; mat: Mat; rating: string; ratingAr: string };
type Template = { hs6: string; family: "valve" | "pump" | "fitting" | "flange"; forms: ((p: Pick) => string)[]; sizes: string[]; materials: Mat[]; ratings: string[] };

const DN: Record<string, string> = { "1/2": "DN15", "3/4": "DN20", "1": "DN25", "2": "DN50", "3": "DN80", "4": "DN100", "6": "DN150", "8": "DN200" };
const ARABIC_DIGITS = (s: string) => s.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
const SS: Mat = { ar: "ستانلس ستيل", en: "stainless steel", abbr: "SS" }, SS316: Mat = { ar: "ستانلس ستيل 316", en: "stainless steel 316", abbr: "SS316" }, CS: Mat = { ar: "كربون ستيل", en: "carbon steel", abbr: "CS" }, CI: Mat = { ar: "حديد زهر", en: "cast iron", abbr: "CI" }, DI: Mat = { ar: "حديد زهر مطاوع", en: "ductile iron", abbr: "DI" }, BR: Mat = { ar: "نحاس", en: "brass", abbr: "BRS" }, PVDF: Mat = { ar: "بي في دي إف", en: "PVDF", abbr: "PVDF" };

const TEMPLATES: Template[] = [
  { hs6: "848180", family: "valve", sizes: ["1/2", "1", "2", "3", "4", "6"], materials: [SS, SS316, CS, CI, DI], ratings: ["PN16", "PN40", "CL150", "CL300"],
    forms: [(p) => `صمام كروي ${p.mat.ar} ${p.sizeAr} بوصة، ضغط ${p.ratingAr}`, (p) => `BALL VLV ${p.size}IN ${p.mat.abbr} ${p.rating} FLGD`, (p) => `Valve, ball, ${p.mat.en}, ${p.size} inch, ${p.rating}`, (p) => `صمام بوابة ${p.mat.ar} ${p.sizeDn} ${p.rating} بشفة`, (p) => `GATE VALVE ${p.size}" ${p.mat.abbr} ${p.rating} FLANGED`, (p) => `Butterfly valve wafer ${p.sizeDn} ${p.mat.en} ${p.rating}`] },
  { hs6: "848130", family: "valve", sizes: ["1", "2", "4", "6"], materials: [SS, CS, BR], ratings: ["PN16", "CL150", "CL300"],
    forms: [(p) => `صمام عدم رجوع ${p.mat.ar} ${p.sizeAr} بوصة`, (p) => `CHK VLV SWING ${p.size}IN ${p.mat.abbr} ${p.rating}`, (p) => `Check valve, ${p.mat.en}, ${p.sizeDn}, ${p.rating}`] },
  { hs6: "848140", family: "valve", sizes: ["1/2", "1", "2"], materials: [SS, BR, CS], ratings: ["10 bar", "16 bar", "40 bar"],
    forms: [(p) => `صمام أمان ${p.mat.ar} ${p.sizeAr} بوصة ضغط ${p.ratingAr}`, (p) => `SAFETY RELIEF VLV ${p.size}IN ${p.mat.abbr} SET ${p.rating}`, (p) => `Pressure relief valve ${p.size} inch ${p.mat.en} ${p.rating}`] },
  { hs6: "841370", family: "pump", sizes: ["25", "50", "100", "200"], materials: [CI, SS, DI], ratings: ["20 m", "40 m", "60 m"],
    forms: [(p) => `مضخة طرد مركزي أفقية ${p.sizeAr} م3/س رفع ${p.ratingAr} ${p.mat.ar}`, (p) => `PMP CENTRIFUGAL END SUCTION ${p.size}M3/HR ${p.rating.replace(" ", "")} HEAD ${p.mat.abbr}`, (p) => `Centrifugal pump ${p.size} m3/h, ${p.rating} head, ${p.mat.en} casing`] },
  { hs6: "841350", family: "pump", sizes: ["5", "20", "50"], materials: [SS, PVDF], ratings: ["10 bar", "16 bar"],
    forms: [(p) => `مضخة جرعات ديافرام ${p.sizeAr} لتر/ساعة ${p.ratingAr} ${p.mat.ar}`, (p) => `DOSING PMP DIAPHRAGM ${p.size}L/H ${p.rating} ${p.mat.abbr} HEAD`, (p) => `Diaphragm dosing pump ${p.size} l/h ${p.rating} ${p.mat.en}`] },
  { hs6: "730723", family: "fitting", sizes: ["1", "2", "3", "4", "6"], materials: [SS316, SS], ratings: ["SCH10", "SCH40"],
    forms: [(p) => `كوع 90 درجة ${p.mat.ar} قطر ${p.sizeAr} بوصة لحام تناكبي ${p.rating}`, (p) => `ELB 90 LR ${p.size}" ${p.rating} ${p.mat.abbr} BW`, (p) => `Butt weld elbow 90 degree ${p.size} inch ${p.rating} ${p.mat.en}`] },
  { hs6: "730793", family: "fitting", sizes: ["2", "4", "6", "8"], materials: [CS], ratings: ["SCH40", "SCH80"],
    forms: [(p) => `تي متساوي ${p.mat.ar} ${p.sizeAr} بوصة ${p.rating} لحام`, (p) => `TEE EQUAL ${p.size}" ${p.rating} ${p.mat.abbr} BW A234`, (p) => `Butt weld equal tee ${p.size} inch ${p.rating} carbon steel`] },
  { hs6: "730791", family: "flange", sizes: ["2", "4", "6", "8"], materials: [CS], ratings: ["CL150", "CL300", "PN16"],
    forms: [(p) => `شفة عمياء ${p.mat.ar} ${p.sizeAr} بوصة كلاس ${p.ratingAr} RF`, (p) => `FLG WN ${p.size}" ${p.rating} RF ${p.mat.abbr} A105`, (p) => `Weld neck flange ${p.size} inch ${p.rating} raised face carbon steel`] },
  { hs6: "730721", family: "flange", sizes: ["2", "4", "6"], materials: [SS316, SS], ratings: ["CL150", "CL300"],
    forms: [(p) => `فلنجة ${p.mat.ar} عنق لحام ${p.sizeAr} بوصة ${p.ratingAr}`, (p) => `FLG WN ${p.size}" ${p.rating} ${p.mat.abbr} RF`, (p) => `Stainless weld neck flange ${p.size} inch ${p.rating}`] },
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = <T>(rnd: () => number, xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;

export function generateDemand(seed: number, imports: { hs6: string; value_usd: number }[], opts: { lines?: number } = {}): DemandSeed[] {
  const rnd = mulberry32(seed);
  const total = opts.lines ?? 96;
  const templates = TEMPLATES.filter((t) => imports.some((i) => i.hs6 === t.hs6));
  const weights = templates.map((t) => Math.sqrt(imports.find((i) => i.hs6 === t.hs6)!.value_usd));
  const wsum = weights.reduce((s, w) => s + w, 0);
  const counts = templates.map((_, i) => Math.max(2, Math.round((weights[i]! / wsum) * total)));
  while (counts.reduce((s, c) => s + c, 0) > total) { const i = counts.indexOf(Math.max(...counts)); counts[i]!--; }
  while (counts.reduce((s, c) => s + c, 0) < total) { const i = counts.indexOf(Math.min(...counts)); counts[i]!++; }
  const out: DemandSeed[] = [];
  templates.forEach((t, ti) => {
    const n = counts[ti]!;
    const shares = Array.from({ length: n }, () => 0.5 + rnd());
    const ssum = shares.reduce((s, x) => s + x, 0);
    const budget = imports.find((i) => i.hs6 === t.hs6)!.value_usd * PORTFOLIO_IMPORT_SHARE;
    let allocated = 0;
    for (let k = 0; k < n; k++) {
      const portco = pick(rnd, PORTCOS);
      const size = pick(rnd, t.sizes), mat = pick(rnd, t.materials), rating = pick(rnd, t.ratings);
      const p: Pick = { size, sizeDn: DN[size] ?? `DN${size}`, sizeAr: ARABIC_DIGITS(size), mat, rating, ratingAr: ARABIC_DIGITS(rating.replace(/^(PN|CL)/, "$1 ")) };
      const form = pick(rnd, t.forms);
      const qty = Math.max(1, Math.round((rnd() ** 2) * (t.family === "pump" ? 12 : 200)));
      const history_factor = Number((6 + rnd() * 60).toFixed(1));
      const value = k === n - 1 ? Number((budget - allocated).toFixed(2)) : Number(((shares[k]! / ssum) * budget).toFixed(2));
      allocated += value;
      out.push({
        line_key: `${seed}:${t.hs6}:${k}`,
        portco: portco.name, source_system: pick(rnd, portco.systems),
        raw_text: form(p), qty, qty_unit: t.family === "pump" ? "units" : "pcs", history_factor,
        seed_hs6: t.hs6, annual_value_usd: value,
      });
    }
  });
  return out;
}
