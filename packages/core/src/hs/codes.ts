export type TarmeezCategory = {
  Title: { Ar: string; En: string };
  Symbol: string;
  Children: TarmeezCategory[] | null;
};

export type HsRow = {
  code: string;
  level: 0 | 2 | 4 | 6;
  parent_code: string | null;
  title_ar: string;
  title_en: string;
};

export function tariffToHs6(code: string): string {
  if (!/^\d{6,12}$/.test(code)) throw new Error(`not a tariff code: ${code}`);
  return code.slice(0, 6);
}

export function hsLevel(symbol: string): 0 | 2 | 4 | 6 {
  if (symbol.includes("-")) return 0;
  if (symbol.length === 2) return 2;
  if (symbol.length === 4) return 4;
  if (symbol.length === 6) return 6;
  throw new Error(`unexpected HS symbol: ${symbol}`);
}

export function flattenCategories(items: TarmeezCategory[]): HsRow[] {
  const out: HsRow[] = [];
  const walk = (node: TarmeezCategory, parent: string | null) => {
    out.push({
      code: node.Symbol,
      level: hsLevel(node.Symbol),
      parent_code: parent,
      title_ar: node.Title.Ar.trim(),
      title_en: node.Title.En.trim(),
    });
    for (const child of node.Children ?? []) walk(child, node.Symbol);
  };
  for (const item of items) walk(item, null);
  return out;
}
