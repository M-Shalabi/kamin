import Link from "next/link";
import { coverageSummary, ledger, ledgerCounts, stats, type GapKind } from "@/lib/queries";
import { A, GapKind as Kind, Int, Legend, Money, SectionHead, SpecStatus, Table, Td, Tr } from "@/components/ui";
import { Ladder } from "@/components/Ladder";
import { fmtInt, fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

const KINDS: { key: GapKind | "all"; label: string }[] = [
  { key: "manufacturing_gap", label: "Manufacturing gaps" },
  { key: "supply_gap", label: "Supply gaps" },
  { key: "covered", label: "Covered" },
  { key: "all", label: "All pooled orders" },
];

function Figure({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="mono text-lg font-semibold leading-none" style={tone ? { color: tone } : undefined}>{value}</span>
      <span className="text-[0.6875rem] leading-tight" style={{ color: "var(--muted)" }}>{label}</span>
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind = "manufacturing_gap" } = await searchParams;
  const k = (KINDS.some((x) => x.key === kind) ? kind : "manufacturing_gap") as GapKind | "all";
  const [rows, s, counts, c] = await Promise.all([ledger(k), stats(), ledgerCounts(), coverageSummary()]);
  const n = (key: string) => (key === "all" ? Object.values(counts).reduce((a, x) => a + x.n, 0) : counts[key]?.n ?? 0);
  const total = rows.reduce((a, r) => a + (r.annual_value_usd ?? 0), 0);

  return (
    <div className="space-y-8">
      {/* The argument, drawn. */}
      <Ladder c={c} />

      {/* What the map is made of. Figures, not prose — the reader is here to
          judge scale, and a sentence hides the numbers inside itself. */}
      <section className="rise" style={{ animationDelay: "160ms" }}>
        <SectionHead eyebrow="The map" title="What is on it" />
        <div className="card grid grid-cols-2 gap-x-6 gap-y-4 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <Figure value={fmtInt(s.suppliers)} label="suppliers" />
          <Figure value={fmtInt(s.investigated)} label="investigated by a Detective" />
          <Figure value={fmtInt(s.capabilities)} label="capabilities claimed" />
          <Figure value={fmtInt(s.supported)} label="supported by the Auditor" tone="var(--ok)" />
          <Figure value={fmtInt(s.refuted)} label="refuted" tone="var(--bad)" />
          <Figure value={fmtInt(s.discovered)} label="found outside Tarmeez" tone="var(--accent)" />
        </div>
      </section>

      {/* The ledger. */}
      <section className="rise space-y-3" style={{ animationDelay: "220ms" }}>
        <SectionHead eyebrow="Pooled demand" title="Gap ledger">
          <p className="mono text-xs" style={{ color: "var(--muted)" }}>
            {rows.length} orders · {fmtMoney(total)}/yr
          </p>
        </SectionHead>

        <nav className="flex flex-wrap gap-1.5 text-sm" aria-label="Filter the ledger">
          {KINDS.map((x) => {
            const on = x.key === k;
            return (
              <Link
                key={x.key}
                href={`/orders?kind=${x.key}`}
                aria-current={on ? "page" : undefined}
                className="inline-flex items-center gap-2 rounded border px-3 py-1 transition-colors"
                style={
                  on
                    ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" }
                    : { background: "var(--surface)", color: "var(--ink-soft)", borderColor: "var(--line)" }
                }
              >
                {x.label}
                <span className="mono text-[0.6875rem]" style={{ opacity: 0.7 }}>{n(x.key)}</span>
              </Link>
            );
          })}
        </nav>

        <Legend />

        <p className="max-w-4xl text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          A <strong style={{ color: "var(--accent)" }}>manufacturing gap</strong> has no supported manufacturer or
          assembler. A <strong style={{ color: "var(--bad)" }}>supply gap</strong> has no supported supplier of any
          class. <em>Spec</em> says how far the best supplier has actually been verified.
        </p>

        {rows.length === 0 && (
          <p className="card p-4 text-sm leading-relaxed">
            Nothing in this view right now. <span className="mono">{n("covered")}</span> pooled orders are covered,{" "}
            <span className="mono">{n("manufacturing_gap")}</span> are manufacturing gaps,{" "}
            <span className="mono">{n("supply_gap")}</span> are supply gaps
            {counts.unmatched ? <> and <span className="mono">{counts.unmatched.n}</span> are not matched yet</> : null}.
            Verdicts arrive as the Auditor swarm runs; the ledger re-sorts on the next matching pass.
          </p>
        )}

        {rows.length > 0 && (
          <Table head={["Pooled order", "HS", "Portcos", "Lines", "Annual qty", "Annual value", "Mandatory", "Kind", "Spec", "Supported", "Pivots"]}>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td>
                  <A href={`/orders/${r.id}`}>{r.title}</A>
                  {r.headline && <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>{r.headline}</div>}
                </Td>
                <Td className="mono text-xs">{r.hs6}</Td>
                <Td><Int v={r.portco_count} /></Td>
                <Td><Int v={r.line_count} /></Td>
                <Td className="whitespace-nowrap"><Int v={r.qty_annual} /> <span className="text-xs" style={{ color: "var(--muted)" }}>{r.qty_unit}</span></Td>
                <Td className="whitespace-nowrap"><Money v={r.annual_value_usd} /></Td>
                <Td>
                  {r.mandatory ? (
                    <span className="text-[0.6875rem] font-medium" style={{ color: "var(--accent)" }}>2027 tranche</span>
                  ) : (
                    <span className="text-[0.6875rem]" style={{ color: "var(--faint)" }}>no</span>
                  )}
                </Td>
                <Td><Kind k={r.gap_kind} /></Td>
                <Td><SpecStatus s={r.spec_status} /></Td>
                <Td><Int v={r.supported_count} /></Td>
                <Td className="text-xs">{r.pivots ?? <span style={{ color: "var(--faint)" }}>·</span>}</Td>
              </Tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
