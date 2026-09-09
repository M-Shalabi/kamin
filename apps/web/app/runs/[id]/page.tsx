import { notFound } from "next/navigation";
import { runDetail } from "@/lib/queries";
import { Agent, Table, Td, Tr, isAgentRole } from "@/components/ui";

export const dynamic = "force-dynamic";
const compact = (v: unknown) => { const s = typeof v === "string" ? v : JSON.stringify(v, null, 1); return s && s.length > 1200 ? s.slice(0, 1200) + " …" : s; };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await runDetail(id);
  if (!r) notFound();
  const tokens = r.steps.reduce((s, x) => s + (x.tokens_in ?? 0) + (x.tokens_out ?? 0), 0);
  return (
    <div className="space-y-4">
      <div>
        <div className="eyebrow">Trajectory · <span className="mono">{r.id}</span></div>
        <h1 className="cond mt-1 flex flex-wrap items-center gap-2.5 text-2xl font-semibold">
          {isAgentRole(r.role) ? <Agent role={r.role} withArabic /> : <span>{r.role}</span>}
          <span className="font-normal" style={{ color: "var(--muted)" }}>on</span>
          <span className="mono text-lg">{r.model}</span>
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Every step this agent took, in order — what it read, what it asked the model, what came back.
        </p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>{r.status}{r.error ? `: ${r.error}` : ""} · input <span className="mono">{r.input_ref}</span> · {r.started_at.slice(0, 19)} · {r.steps.length} steps · {tokens} tokens</p>
      </div>
      <Table head={["#", "Kind", "Step", "ms", "Tokens", "Input", "Output"]}>
        {r.steps.map((s) => <Tr key={s.seq}><Td className="mono">{s.seq}</Td><Td className="text-xs">{s.kind}</Td><Td>{s.name}</Td><Td className="mono">{s.duration_ms ?? "-"}</Td><Td className="mono text-xs">{s.tokens_in ? `${s.tokens_in}→${s.tokens_out ?? 0}` : "-"}</Td><Td><pre className="max-w-md whitespace-pre-wrap text-xs">{compact(s.input)}</pre></Td><Td><pre className="max-w-lg whitespace-pre-wrap text-xs">{compact(s.output)}</pre></Td></Tr>)}
      </Table>
    </div>
  );
}
