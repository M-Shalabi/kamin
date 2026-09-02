import { notFound } from "next/navigation";
import { runDetail } from "@/lib/queries";
import { Table, Td } from "@/components/ui";

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
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Run <span className="mono">{r.id}</span></div>
        <h1 className="text-2xl font-semibold">{r.role} on <span className="mono">{r.model}</span></h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>{r.status}{r.error ? `: ${r.error}` : ""} · input <span className="mono">{r.input_ref}</span> · {r.started_at.slice(0, 19)} · {r.steps.length} steps · {tokens} tokens</p>
      </div>
      <Table head={["#", "Kind", "Step", "ms", "Tokens", "Input", "Output"]}>
        {r.steps.map((s) => <tr key={s.seq}><Td className="mono">{s.seq}</Td><Td className="text-xs">{s.kind}</Td><Td>{s.name}</Td><Td className="mono">{s.duration_ms ?? "-"}</Td><Td className="mono text-xs">{s.tokens_in ? `${s.tokens_in}→${s.tokens_out ?? 0}` : "-"}</Td><Td><pre className="max-w-md whitespace-pre-wrap text-xs">{compact(s.input)}</pre></Td><Td><pre className="max-w-lg whitespace-pre-wrap text-xs">{compact(s.output)}</pre></Td></tr>)}
      </Table>
    </div>
  );
}
