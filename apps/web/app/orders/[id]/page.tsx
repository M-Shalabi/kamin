import { notFound } from "next/navigation";
import { orderDetail } from "@/lib/queries";
import { A, Agent, Ar, ClassBadge, GapKind, Int, Money, Pct, SectionHead, SpecStatus, Table, Td, Tier, Tr, Verdict, WrittenBy } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await orderDetail(id);
  if (!o) notFound();
  const env = o.spec_envelope as Record<string, string | number | null>;
  const gc = o.gap_case as { headline?: string; why_now?: string; regulatory_pressure?: string; raw_materials?: string; recommended_next_step?: string; pivot_candidates?: { supplier_id: string; supplier_name: string; why: string; what_they_have: string; what_is_missing: string }[] } | null;
  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">Pooled order · <span className="mono">HS {o.hs6}</span></div>
        <h1 className="cond mt-1 text-3xl font-semibold tracking-tight">{o.title}</h1>
        <p className="mt-1 text-sm"><GapKind k={o.gap_kind} /> · <SpecStatus s={o.spec_status} long /> · <Int v={o.portco_count} /> portfolio companies · <Int v={o.qty_now} /> {o.qty_unit} now, <Int v={o.qty_annual} /> a year · <Money v={o.annual_value_usd} /> a year · national imports 2024 <Money v={o.import_value_usd} />{o.mandatory ? " · on the announced Mandatory List tranche (1 August 2027)" : ""}</p>
        <div className="mt-3">
          <div className="eyebrow mb-1.5">Spec envelope · the tightest thing any line demands</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(env).filter(([, v]) => v !== null && v !== "").map(([k, v]) => (
              <span key={k} className="inline-flex items-baseline gap-1.5 rounded border px-2 py-0.5 text-xs" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                <span style={{ color: "var(--muted)" }}>{k.replace(/_/g, " ")}</span>
                <span className="mono font-medium">{String(v)}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <section>
        <SectionHead eyebrow="Demand side" title="The lines that became this order">
          <WrittenBy role="coordinator" verb="resolved and pooled by" />
        </SectionHead>
        <Table head={["Company", "System", "As written", "Qty", "Annual factor", "Annual value", "Anchor", "Confidence", "Resolved by"]}>
          {o.lines.map((l) => (
            <Tr key={l.id}>
              <Td>{l.portco}</Td><Td className="text-xs">{l.source_system}</Td><Td><Ar s={l.raw_text} /></Td><Td><Int v={l.qty} /> {l.qty_unit}</Td><Td>×<Int v={l.history_factor} /></Td><Td><Money v={l.annual_value_usd} /></Td><Td className="mono">{l.hs6}</Td><Td><Pct v={l.confidence} /></Td><Td>{l.run_id ? <Agent role="coordinator" runId={l.run_id} /> : <span className="text-[0.6875rem]" style={{ color: "var(--faint)" }}>·</span>}</Td>
            </Tr>
          ))}
        </Table>
      </section>

      <section>
        <SectionHead eyebrow="Supply side" title="Who could serve it">
          <WrittenBy role="auditor" verb="verdicts by" />
        </SectionHead>
        {o.matches.length === 0 && <p className="text-sm" style={{ color: "var(--muted)" }}>No capability under this heading on the map. This is a supply gap.</p>}
        {o.matches.length > 0 && (
          <Table head={["Rank", "Supplier", "Region", "Product", "Class", "Verdict", "Evidence", "Confidence", "Score", "Share"]}>
            {o.matches.map((m) => (
              <Tr key={m.capability_id}>
                <Td className="mono">{m.rank}</Td>
                <Td><A href={`/suppliers/${m.supplier_id}`}>{m.supplier_name}</A>{m.in_made_in_saudi && <span className="ml-1 text-xs" style={{ color: "var(--ok)" }}>Made in Saudi</span>}</Td>
                <Td className="text-xs">{m.region}</Td>
                <Td><A href={`/evidence/${m.capability_id}`}>{m.product}</A></Td>
                <Td><ClassBadge c={m.class} /></Td>
                <Td><Verdict v={m.verdict} /></Td>
                <Td><Tier t={m.best_tier} /></Td>
                <Td><Pct v={m.confidence} /></Td>
                <Td className="mono">{m.score.toFixed(3)}</Td>
                <Td><Pct v={m.share} /></Td>
              </Tr>
            ))}
          </Table>
        )}
      </section>

      {gc && (
        <section className="card overflow-hidden p-0" style={{ borderColor: "var(--accent)" }}>
          <div className="px-5 py-2" style={{ background: "var(--accent-soft)" }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow" style={{ color: "var(--accent-ink)" }}>Investment case</span>
              <WrittenBy role="advisor" />
            </div>
          </div>
          <div className="p-5">
          <h2 className="cond text-xl font-semibold">{gc.headline}</h2>
          <p className="mt-1 text-sm">{gc.why_now}</p>
          <p className="mt-1 text-sm"><span className="font-medium">Regulatory pressure:</span> {gc.regulatory_pressure}</p>
          <p className="mt-1 text-sm"><span className="font-medium">Raw materials:</span> {gc.raw_materials}</p>
          {gc.pivot_candidates && gc.pivot_candidates.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-sm font-medium">Who could pivot into it</div>
              <ul className="space-y-1 text-sm">{gc.pivot_candidates.map((p) => <li key={p.supplier_id}><A href={`/suppliers/${p.supplier_id}`}>{p.supplier_name}</A>: {p.why} <span style={{ color: "var(--muted)" }}>Has: {p.what_they_have}. Missing: {p.what_is_missing}.</span></li>)}</ul>
            </div>
          )}
          <p className="mt-3 border-t pt-3 text-sm" style={{ borderColor: "var(--line)" }}><span className="font-medium">Next step:</span> {gc.recommended_next_step}</p>
          </div>
        </section>
      )}
    </div>
  );
}
