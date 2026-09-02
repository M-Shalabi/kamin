import { notFound } from "next/navigation";
import { supplierDetail } from "@/lib/queries";
import { A, Ar, ClassBadge, Int, Pct, Registry, Table, Td, Tier, Verdict } from "@/components/ui";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "@kamin/core/src/paths";
import { ColdMiss } from "@/components/ColdMiss";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await supplierDetail(decodeURIComponent(id));
  if (!s) notFound();
  const hasRecording = existsSync(join(REPO_ROOT, "apps/web/public/cold-miss", `${s.id}.json`));
  const pending = s.detective_status === "pending";
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Supplier <span className="mono">{s.id}</span>{s.cr_number && <> · CR <span className="mono">{s.cr_number}</span></>}</div>
        <h1 className="text-2xl font-semibold">{s.name_en ?? s.name_ar}</h1>
        <div className="text-sm" style={{ color: "var(--muted)" }}><Ar s={s.name_ar} /> · {s.city_en}{s.region_en ? `, ${s.region_en}` : ""}{s.investment_type ? ` · ${s.investment_type}` : ""}{s.website && <> · <a className="underline" href={s.website} target="_blank" rel="noreferrer">{s.website}</a></>}</div>
        <div className="mt-2"><Registry tarmeez={s.in_tarmeez} mlcp={s.in_mlcp} mis={s.in_made_in_saudi} source={s.source} /></div>
        {s.summary && <p className="mt-2 max-w-3xl text-sm">{s.summary}</p>}
      </div>
      {(pending || hasRecording) && <ColdMiss supplierId={s.id} pending={pending} hasRecording={hasRecording} />}
      <section>
        <h2 className="mb-2 font-semibold">Capabilities ({s.capabilities.length})</h2>
        <Table head={["Product", "HS", "Class", "Verdict", "Confidence", "Evidence", "Best tier", "Origin", "Declared capacity"]}>
          {s.capabilities.map((c) => (
            <tr key={c.id}>
              <Td><A href={`/evidence/${c.id}`}>{c.product}</A>{c.product_ar && <div className="text-xs" style={{ color: "var(--muted)" }}><Ar s={c.product_ar} /></div>}</Td>
              <Td className="mono">{c.hs6 === "000000" ? <span style={{ color: "var(--muted)" }}>unclassified</span> : c.hs6}</Td><Td><ClassBadge c={c.class} /></Td><Td><Verdict v={c.verdict} /></Td><Td><Pct v={c.confidence} /></Td><Td><Int v={c.evidence_count} /></Td><Td><Tier t={c.best_tier} /></Td><Td className="text-xs">{c.origin}</Td><Td>{c.declared_amount ? <><Int v={c.declared_amount} /> {c.declared_unit}/yr</> : "-"}</Td>
            </tr>
          ))}
        </Table>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Runs on this supplier ({s.runs.length})</h2>
        <Table head={["Role", "Status", "Model", "Started", "Seconds", ""]}>
          {s.runs.map((r) => <tr key={r.id}><Td>{r.role}</Td><Td>{r.status}</Td><Td className="mono text-xs">{r.model}</Td><Td className="text-xs">{r.started_at.slice(0, 19)}</Td><Td className="mono">{r.seconds?.toFixed(0) ?? "-"}</Td><Td><A href={`/runs/${r.id}`}>trajectory</A></Td></tr>)}
        </Table>
      </section>
    </div>
  );
}
