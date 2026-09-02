import Link from "next/link";
import { ledger, ledgerCounts, stats, type GapKind } from "@/lib/queries";
import { A, GapKind as Kind, Int, Money, Table, Td } from "@/components/ui";

export const dynamic = "force-dynamic";
const KINDS: { key: GapKind | "all"; label: string }[] = [{ key: "manufacturing_gap", label: "Manufacturing gaps" }, { key: "supply_gap", label: "Supply gaps" }, { key: "covered", label: "Covered" }, { key: "all", label: "All pooled orders" }];

export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind = "manufacturing_gap" } = await searchParams;
  const k = (KINDS.some((x) => x.key === kind) ? kind : "manufacturing_gap") as GapKind | "all";
  const [rows, s, counts] = await Promise.all([ledger(k), stats(), ledgerCounts()]);
  const n = (key: string) => (key === "all" ? Object.values(counts).reduce((a, c) => a + c.n, 0) : (counts[key]?.n ?? 0));
  const total = rows.reduce((a, r) => a + (r.annual_value_usd ?? 0), 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold">Gap ledger</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}><Int v={s.suppliers} /> suppliers on the map, <Int v={s.investigated} /> investigated, <Int v={s.supported} /> supported capabilities, <Int v={s.refuted} /> refuted, <Int v={s.discovered} /> found outside Tarmeez.</p>
      </div>
      <nav className="flex gap-2 text-sm">{KINDS.map((x) => <Link key={x.key} href={`/?kind=${x.key}`} className="rounded px-3 py-1" style={{ background: x.key === k ? "var(--ink)" : "#ebe6dc", color: x.key === k ? "var(--paper)" : "var(--ink)" }}>{x.label} <span className="mono text-xs">{n(x.key)}</span></Link>)}</nav>
      <p className="text-sm" style={{ color: "var(--muted)" }}>{rows.length} pooled orders worth <Money v={total} /> a year. A manufacturing gap has no supported manufacturer or assembler; a supply gap has no supported supplier of any class.</p>
      {rows.length === 0 && <p className="rounded border p-3 text-sm" style={{ borderColor: "var(--line)" }}>Nothing in this view right now: {n("covered")} pooled orders are covered, {n("manufacturing_gap")} are manufacturing gaps, {n("supply_gap")} are supply gaps{counts.unmatched ? ` and ${counts.unmatched.n} are not matched yet` : ""}. Verdicts arrive as the Auditor swarm runs; the ledger re-sorts on the next matching pass.</p>}
      <Table head={["Pooled order", "HS", "Portcos", "Lines", "Annual qty", "Annual value", "Mandatory", "Kind", "Supported", "Pivots"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <Td><A href={`/orders/${r.id}`}>{r.title}</A>{r.headline && <div className="text-xs" style={{ color: "var(--muted)" }}>{r.headline}</div>}</Td>
            <Td className="mono">{r.hs6}</Td>
            <Td><Int v={r.portco_count} /></Td>
            <Td><Int v={r.line_count} /></Td>
            <Td><Int v={r.qty_annual} /> {r.qty_unit}</Td>
            <Td><Money v={r.annual_value_usd} /></Td>
            <Td>{r.mandatory ? <span style={{ color: "var(--accent)" }}>2027 tranche</span> : "no"}</Td>
            <Td><Kind k={r.gap_kind} /></Td>
            <Td><Int v={r.supported_count} /></Td>
            <Td>{r.pivots ?? "-"}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
