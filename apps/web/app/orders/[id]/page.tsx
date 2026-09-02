import { notFound } from "next/navigation";
import { orderDetail } from "@/lib/queries";
import { A, Ar, ClassBadge, GapKind, Int, Money, Pct, Table, Td, Tier, Verdict } from "@/components/ui";

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
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Pooled order <span className="mono">HS {o.hs6}</span></div>
        <h1 className="text-2xl font-semibold">{o.title}</h1>
        <p className="mt-1 text-sm"><GapKind k={o.gap_kind} /> · <span className="text-xs" style={{ color: o.spec_status === "at_spec" ? "#1f7a3a" : "var(--accent)" }}>{o.spec_status === "at_spec" ? "verified at the stated specification" : o.spec_status === "category" ? "declared at category level, specification unverified" : o.spec_status === "none" ? "no supported supplier" : "not matched yet"}</span> · <Int v={o.portco_count} /> portfolio companies · <Int v={o.qty_now} /> {o.qty_unit} now, <Int v={o.qty_annual} /> a year · <Money v={o.annual_value_usd} /> a year · national imports 2024 <Money v={o.import_value_usd} />{o.mandatory ? " · on the announced Mandatory List tranche (1 August 2027)" : ""}</p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>Envelope: {Object.entries(env).filter(([, v]) => v !== null && v !== "").map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(" · ")}</p>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">The lines that became this order</h2>
        <Table head={["Company", "System", "As written", "Qty", "Annual factor", "Annual value", "Anchor", "Confidence", "Run"]}>
          {o.lines.map((l) => (
            <tr key={l.id}>
              <Td>{l.portco}</Td><Td className="text-xs">{l.source_system}</Td><Td><Ar s={l.raw_text} /></Td><Td><Int v={l.qty} /> {l.qty_unit}</Td><Td>×<Int v={l.history_factor} /></Td><Td><Money v={l.annual_value_usd} /></Td><Td className="mono">{l.hs6}</Td><Td><Pct v={l.confidence} /></Td><Td>{l.run_id && <A href={`/runs/${l.run_id}`}>trajectory</A>}</Td>
            </tr>
          ))}
        </Table>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Who could serve it</h2>
        {o.matches.length === 0 && <p className="text-sm" style={{ color: "var(--muted)" }}>No capability under this heading on the map. This is a supply gap.</p>}
        {o.matches.length > 0 && (
          <Table head={["Rank", "Supplier", "Region", "Product", "Class", "Verdict", "Evidence", "Confidence", "Score", "Share"]}>
            {o.matches.map((m) => (
              <tr key={m.capability_id}>
                <Td className="mono">{m.rank}</Td>
                <Td><A href={`/suppliers/${m.supplier_id}`}>{m.supplier_name}</A>{m.in_made_in_saudi && <span className="ml-1 text-xs" style={{ color: "#1f7a3a" }}>Made in Saudi</span>}</Td>
                <Td className="text-xs">{m.region}</Td>
                <Td><A href={`/evidence/${m.capability_id}`}>{m.product}</A></Td>
                <Td><ClassBadge c={m.class} /></Td>
                <Td><Verdict v={m.verdict} /></Td>
                <Td><Tier t={m.best_tier} /></Td>
                <Td><Pct v={m.confidence} /></Td>
                <Td className="mono">{m.score.toFixed(3)}</Td>
                <Td><Pct v={m.share} /></Td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      {gc && (
        <section className="rounded border p-4" style={{ borderColor: "var(--accent)" }}>
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--accent)" }}>Investment case, written by the Advisor</div>
          <h2 className="text-lg font-semibold">{gc.headline}</h2>
          <p className="mt-1 text-sm">{gc.why_now}</p>
          <p className="mt-1 text-sm"><span className="font-medium">Regulatory pressure:</span> {gc.regulatory_pressure}</p>
          <p className="mt-1 text-sm"><span className="font-medium">Raw materials:</span> {gc.raw_materials}</p>
          {gc.pivot_candidates && gc.pivot_candidates.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-sm font-medium">Who could pivot into it</div>
              <ul className="space-y-1 text-sm">{gc.pivot_candidates.map((p) => <li key={p.supplier_id}><A href={`/suppliers/${p.supplier_id}`}>{p.supplier_name}</A>: {p.why} <span style={{ color: "var(--muted)" }}>Has: {p.what_they_have}. Missing: {p.what_is_missing}.</span></li>)}</ul>
            </div>
          )}
          <p className="mt-3 text-sm"><span className="font-medium">Next step:</span> {gc.recommended_next_step}</p>
        </section>
      )}
    </div>
  );
}
