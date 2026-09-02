import { supplierList } from "@/lib/queries";
import { A, Ar, ClassBadge, Int, Registry, Table, Td } from "@/components/ui";

export const dynamic = "force-dynamic";
const FAMILIES = ["valve", "pump", "fitting"], CLASSES = ["manufacturer", "assembler", "authorised_distributor", "trader"], VERDICTS = ["supported", "pending", "refuted"];
const REGISTRIES: [string, string][] = [["tarmeez", "Tarmeez"], ["mlcp", "MLCP"], ["made_in_saudi", "Made in Saudi"], ["discovered", "Outside Tarmeez"]];

function Sel({ name, options, label, value }: { name: string; options: [string, string][]; label: string; value?: string }) {
  return (
    <label className="text-xs" style={{ color: "var(--muted)" }}>{label}
      <select name={name} defaultValue={value ?? ""} className="ml-1 rounded border bg-transparent px-1 py-0.5 text-sm" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
        <option value="">any</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const f = await searchParams;
  const rows = await supplierList({ family: f.family, region: f.region, cls: f.cls, verdict: f.verdict, registry: f.registry, q: f.q });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Capabilities in the valve, pump and fitting slice</h1>
      <form className="flex flex-wrap items-end gap-3 text-sm">
        <Sel name="family" label="Family" value={f.family} options={FAMILIES.map((x) => [x, x] as [string, string])} />
        <Sel name="cls" label="Class" value={f.cls} options={CLASSES.map((x) => [x, x.replace(/_/g, " ")] as [string, string])} />
        <Sel name="verdict" label="Verdict" value={f.verdict} options={VERDICTS.map((x) => [x, x] as [string, string])} />
        <Sel name="registry" label="Registry" value={f.registry} options={REGISTRIES} />
        <label className="text-xs" style={{ color: "var(--muted)" }}>Name or CR <input name="q" defaultValue={f.q ?? ""} className="ml-1 rounded border bg-transparent px-2 py-0.5 text-sm" style={{ borderColor: "var(--line)" }} /></label>
        <button className="rounded px-3 py-1 text-sm" style={{ background: "var(--ink)", color: "var(--paper)" }}>Filter</button>
      </form>
      <p className="text-sm" style={{ color: "var(--muted)" }}>{rows.length} suppliers, ordered by supported capabilities.</p>
      <Table head={["Supplier", "City", "Region", "Registries", "Investigated", "Capabilities", "Supported", "Best class"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <Td><A href={`/suppliers/${encodeURIComponent(r.id)}`}>{r.name_en ?? r.id}</A><div className="text-xs" style={{ color: "var(--muted)" }}><Ar s={r.name_ar} /></div></Td>
            <Td className="text-xs">{r.city_en}</Td><Td className="text-xs">{r.region_en}</Td>
            <Td><Registry tarmeez={r.in_tarmeez} mlcp={r.in_mlcp} mis={r.in_made_in_saudi} source={r.source} /></Td>
            <Td className="text-xs">{r.detective_status}</Td><Td><Int v={r.capability_count} /></Td><Td><Int v={r.supported_count} /></Td><Td>{r.best_class && <ClassBadge c={r.best_class} />}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
