import type { Sql } from "postgres";

export async function lcSignals(db: Sql, capabilityId: string) {
  const [r] = await db<{ class: string; hs6: string; in_made_in_saudi: boolean; cr_number: string | null; in_tarmeez: boolean; in_mlcp: boolean }[]>`
    select c.class, c.hs6, s.in_made_in_saudi, s.cr_number, s.in_tarmeez, s.in_mlcp from capabilities c join suppliers s on s.id = c.supplier_id where c.id = ${capabilityId}`;
  if (!r) throw new Error(`capability ${capabilityId} not found`);
  const [m] = await db<{ n: number }[]>`select count(*)::int as n from mandatory_list where hs4 = ${r.hs6.slice(0, 4)}`;
  const in_registries = [r.in_tarmeez ? "tarmeez" : null, r.in_mlcp ? "mlcp" : null, r.in_made_in_saudi ? "made_in_saudi" : null].filter(Boolean) as string[];
  return { class: r.class, made_in_saudi: r.in_made_in_saudi, mandatory: (m?.n ?? 0) > 0, cr_present: !!r.cr_number, in_registries, g1: null as null };
}
