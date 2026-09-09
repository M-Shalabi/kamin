"use client";
import { useEffect, useRef, useState } from "react";

type Rec = { supplierId: string; recordedAt: string; events: { t: number; line: string }[] };
type State = "idle" | "live" | "recording" | "done" | "error";

export function ColdMiss({ supplierId, pending, hasRecording }: { supplierId: string; pending: boolean; hasRecording: boolean }) {
  const [lines, setLines] = useState<string[]>([]);
  const [state, setState] = useState<State>("idle");
  const box = useRef<HTMLPreElement>(null);
  const recUrl = `/cold-miss/${encodeURIComponent(supplierId)}.json`;

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [lines]);

  const live = () => {
    setLines([]); setState("live");
    const es = new EventSource(`/api/cold-miss/${encodeURIComponent(supplierId)}`);
    es.onmessage = (e) => setLines((l) => [...l, JSON.parse(e.data) as string]);
    es.addEventListener("done", () => { es.close(); setState("done"); setTimeout(() => location.reload(), 2000); });
    es.addEventListener("error", (e) => {
      es.close();
      const data = (e as MessageEvent).data as string | undefined;
      setLines((l) => [...l, `error: ${data ? JSON.parse(data) : "stream closed"}`]); setState("error");
    });
  };
  const play = async () => {
    setLines([]); setState("recording");
    const rec = (await (await fetch(recUrl)).json()) as Rec;
    let last = 0;
    for (const ev of rec.events) {
      await new Promise((r) => setTimeout(r, Math.min(1500, (ev.t - last) / 4)));
      last = ev.t; setLines((l) => [...l, ev.line]);
    }
    setState("done");
  };
  const busy = state === "live" || state === "recording";
  return (
    <section className="rounded border p-4" style={{ borderColor: "var(--accent)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--accent)" }}>Cold miss</div>
          <p className="text-sm">{pending ? "This supplier is on the map with declared capabilities only. Run the Detective and the Auditor now and watch the evidence, the class and the verdict write themselves onto this node." : "This supplier was a cold miss: on the map with declared capabilities only until the Detective and the Auditor ran. The recording replays that run."}</p>
        </div>
        <div className="flex gap-2">
          {pending && <button onClick={live} disabled={busy} className="rounded px-3 py-1 text-sm disabled:opacity-50" style={{ background: "var(--accent)", color: "white" }}>Investigate live</button>}
          {hasRecording && <button onClick={play} disabled={busy} className="rounded border px-3 py-1 text-sm disabled:opacity-50" style={{ borderColor: "var(--line)" }}>Play recording</button>}
        </div>
      </div>
      {lines.length > 0 && <pre ref={box} className="mono mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded p-3 text-xs" style={{ background: "var(--ink)", color: "#e9e4da" }}>{lines.join("\n")}</pre>}
      {state === "done" && <p className="mt-2 text-sm" style={{ color: "var(--ok)" }}>Written to the graph{lines.some((l) => l.startsWith("▷ done")) ? ". Reloading." : "."}</p>}
    </section>
  );
}
