import { notFound } from "next/navigation";
import { capabilityDetail } from "@/lib/queries";
import { A, Agent, Ar, ClassBadge, Pct, Table, Td, Tier, Tr, Verdict, WrittenBy } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await capabilityDetail(id);
  if (!c) notFound();
  const lenses = c.lenses as { analysis?: string; real?: { verdict: string; reasoning: string; killer_evidence: string | null }; at_spec?: { verdict: string; reasoning: string }; local?: { class: string; reasoning: string } } | null;
  const signals = [c.in_made_in_saudi && "Made in Saudi certified", c.mandatory && "heading on the announced Mandatory List tranche", c.cr_number && "commercial registration on record", c.in_tarmeez && "declared in Tarmeez", c.in_mlcp && "listed by the Madinah chamber"].filter(Boolean) as string[];
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Capability · <A href={`/suppliers/${encodeURIComponent(c.supplier_id)}`}>{c.supplier_name}</A> <Ar s={c.supplier_name_ar} /></div>
        <h1 className="text-2xl font-semibold">{c.product} <span className="mono text-base" style={{ color: "var(--muted)" }}>{c.hs6 === "000000" ? "HS unclassified" : `HS ${c.hs6}`}</span></h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"><ClassBadge c={c.class} /> <span aria-hidden>·</span> <Verdict v={c.verdict} /> {c.audit_run_id && <><span aria-hidden>·</span> <WrittenBy role="auditor" runId={c.audit_run_id} verb="judged by" /></>} <span aria-hidden>·</span> <span>confidence <Pct v={c.confidence} /></span> <span aria-hidden>·</span> <span>origin {c.origin}</span>{c.declared_amount ? ` · declared ${c.declared_amount} ${c.declared_unit ?? ""} a year` : ""}</p>
        {Object.keys(c.spec_attrs ?? {}).length > 0 && <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>Stated: {Object.entries(c.spec_attrs).map(([k, v]) => `${k} ${v}`).join(" · ")}</p>}
      </div>
      <section>
        <h2 className="mb-2 font-semibold">Evidence chain ({c.evidence.length})</h2>
        <p className="mb-2 text-xs" style={{ color: "var(--muted)" }}>Tier 1 third-party verified · Tier 2 official registry · Tier 3 self-published · Tier 4 inferred. A capability counts toward coverage only when supported and backed by Tier 1 or 2.</p>
        <Table head={["Tier", "Written by", "Kind", "Source", "Excerpt", "Run"]}>
          {c.evidence.map((e) => <Tr key={e.id}><Td><Tier t={e.tier} /></Td><Td>{e.role ? <Agent role={e.role} runId={e.run_id} /> : <span className="text-[0.6875rem]" style={{ color: "var(--faint)" }}>registry import</span>}</Td><Td className="text-xs">{e.source_type}</Td><Td className="text-xs"><a className="underline" href={e.source_url} target="_blank" rel="noreferrer">{e.title ?? e.source_url.slice(0, 60)}</a></Td><Td className="text-sm"><Ar s={e.excerpt} /></Td><Td>{e.run_id ? <A href={`/runs/${e.run_id}`}>trajectory</A> : <span style={{ color: "var(--faint)" }}>·</span>}</Td></Tr>)}
        </Table>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded border p-4" style={{ borderColor: "var(--line)" }}>
          <h2 className="mb-2 font-semibold">Auditor verdict</h2>
          {!lenses && <p className="text-sm" style={{ color: "var(--muted)" }}>Not audited yet.</p>}
          {lenses && (
            <dl className="space-y-2 text-sm">
              {lenses.analysis && <div><dt className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Working notes</dt><dd>{lenses.analysis}</dd></div>}
              <div><dt className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Is it real</dt><dd><Verdict v={lenses.real?.verdict ?? "unknown"} /> {lenses.real?.reasoning}{lenses.real?.killer_evidence && <span className="block" style={{ color: "var(--bad)" }}>Killer evidence: {lenses.real.killer_evidence}</span>}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Is it at specification</dt><dd><Verdict v={lenses.at_spec?.verdict ?? "unknown"} /> {lenses.at_spec?.reasoning}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>How local</dt><dd>{lenses.local && <ClassBadge c={lenses.local.class} />} {lenses.local?.reasoning}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Auditor's own confidence</dt><dd><Pct v={c.class_confidence} /></dd></div>
            </dl>
          )}
        </div>
        <div className="rounded border p-4" style={{ borderColor: "var(--line)" }}>
          <h2 className="mb-2 font-semibold">Local content signals</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">{signals.length ? signals.map((s) => <li key={s}>{s}</li>) : <li>none beyond the class</li>}</ul>
          <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>The LCGPA G1 score is computed only from a supplier's declared inputs (Saudi salaries, local procurement, local assets, capability building) and never from class. No inputs on record for this supplier, so no score is shown. Methodology: G1 Baseline Template N.1.</p>
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Runs behind this claim</h2>
        <Table head={["Role", "Status", "Model", "Started", "Seconds", ""]}>
          {c.runs.map((r) => <Tr key={r.id}><Td>{r.role}</Td><Td>{r.status}</Td><Td className="mono text-xs">{r.model}</Td><Td className="text-xs">{r.started_at.slice(0, 19)}</Td><Td className="mono">{r.seconds?.toFixed(0) ?? "-"}</Td><Td><A href={`/runs/${r.id}`}>trajectory</A></Td></Tr>)}
        </Table>
      </section>
    </div>
  );
}
