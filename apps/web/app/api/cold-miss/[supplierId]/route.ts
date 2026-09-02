import { coldMiss } from "@kamin/core/src/coldmiss";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

/** Server-sent events: one `data:` frame per trajectory line, then `event: done` with the summary. */
export async function GET(_req: Request, { params }: { params: Promise<{ supplierId: string }> }) {
  const { supplierId } = await params;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const frame = (s: string) => { try { controller.enqueue(encoder.encode(s)); } catch { /* client went away; the run finishes anyway */ } };
      const send = (line: string) => frame(`data: ${JSON.stringify(line)}\n\n`);
      try {
        const result = await coldMiss(sql, decodeURIComponent(supplierId), send);
        frame(`event: done\ndata: ${JSON.stringify(result)}\n\n`);
      } catch (err) {
        frame(`event: error\ndata: ${JSON.stringify((err as Error).message)}\n\n`);
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
