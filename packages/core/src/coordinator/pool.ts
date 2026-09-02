import type { NormalizedSpecT } from "./schema";

export type Envelope = {
  object_class: string; object_family: string; size_inch: number | null; size_dn: number | null;
  pressure_bar: number | null; pressure_class: string | null; material: string | null; material_grade: string | null; connection: string | null;
};
export type PoolInputLine = { id: string; portco: string; hs6: string; spec: NormalizedSpecT; quantity: number | null };
export type PooledOrder = { hs6: string; envelope: Envelope; lineIds: string[]; portcos: string[]; qty_now: number | null };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const sameOrMissing = <T>(x: T | null, y: T | null) => x === null || y === null || x === y;

export function compatible(a: NormalizedSpecT, b: NormalizedSpecT): boolean {
  if (norm(a.object_class) !== norm(b.object_class)) return false;
  if (a.object_family !== b.object_family) return false;
  if (a.size_dn !== null && b.size_dn !== null && a.size_dn !== b.size_dn) return false;
  if (a.size_inch !== null && b.size_inch !== null && a.size_inch !== b.size_inch) return false;
  if (!sameOrMissing(a.material, b.material)) return false;
  if (!sameOrMissing(a.material_grade, b.material_grade)) return false;
  if (!sameOrMissing(a.connection, b.connection)) return false;
  if (!sameOrMissing(a.pressure_class, b.pressure_class)) return false;
  return true;
}

const tightest = (values: (number | null)[]) => values.reduce<number | null>((m, v) => (v === null ? m : m === null ? v : Math.max(m, v)), null);
const firstNonNull = <T>(values: (T | null)[]) => values.find((v) => v !== null) ?? null;

export function specEnvelope(specs: NormalizedSpecT[]): Envelope {
  const first = specs[0]!;
  return {
    object_class: norm(first.object_class), object_family: first.object_family,
    size_inch: firstNonNull(specs.map((s) => s.size_inch)), size_dn: firstNonNull(specs.map((s) => s.size_dn)),
    pressure_bar: tightest(specs.map((s) => s.pressure_bar)), pressure_class: firstNonNull(specs.map((s) => s.pressure_class)),
    material: firstNonNull(specs.map((s) => s.material)), material_grade: firstNonNull(specs.map((s) => s.material_grade)),
    connection: firstNonNull(specs.map((s) => s.connection)),
  };
}

export function poolLines(lines: PoolInputLine[]): PooledOrder[] {
  const groups: PoolInputLine[][] = [];
  for (const line of lines) {
    const g = groups.find((grp) => grp[0]!.hs6 === line.hs6 && grp.every((l) => compatible(l.spec, line.spec)));
    if (g) g.push(line); else groups.push([line]);
  }
  return groups.map((g) => ({
    hs6: g[0]!.hs6,
    envelope: specEnvelope(g.map((l) => l.spec)),
    lineIds: g.map((l) => l.id),
    portcos: [...new Set(g.map((l) => l.portco))],
    qty_now: g.some((l) => l.quantity !== null) ? g.reduce((s, l) => s + (l.quantity ?? 0), 0) : null,
  }));
}
