import Link from "next/link";
import type { GraphEdge } from "@/lib/queries";

/**
 * The knowledge graph, drawn.
 *
 * Layout is deterministic and computed here rather than simulated in the
 * browser, so it renders identically every time and costs no client JS. The
 * arrangement is chosen to tell the truth about the data: 18 suppliers each
 * hold a small star of objects that nobody else shares, and exactly four
 * objects bridge more than one supplier. A force simulation would scatter that
 * into a snowflake field and hide the one interesting fact.
 *
 * So: suppliers ride a circle, their private objects sit on an arc just
 * outside them, and the four shared objects are pulled into the middle where
 * the bridges they form are visible.
 */

const PRED_TINT: Record<string, string> = {
  certified_by: "#12703A",
  meets_standard: "#0F8A8A",
  distributes_brand: "#5B7CC7",
  part_of_group: "#8A63C4",
  same_entity_as: "#8A63C4",
  makes_with_material: "#C0632A",
  uses_process: "#C0632A",
};

const W = 1400;
const H = 940;
const CX = W / 2;
const CY = H / 2;
const R_HUB = 250;        // supplier ring
const R_LEAF = 352;       // private objects, just outside their supplier
const R_BRIDGE = 96;      // shared objects, pulled to the middle

type Node = { x: number; y: number };

const pol = (a: number, r: number): Node => ({ x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r });

/** A gentle curve toward the centre, so many edges stay readable. */
function curve(a: Node, b: Node, pull = 0.22) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${(mx + (CX - mx) * pull).toFixed(1)},${(my + (CY - my) * pull).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
}

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function GraphMap({ edges }: { edges: GraphEdge[] }) {
  // Group edges by supplier, and find the objects more than one supplier holds.
  const bySupplier = new Map<string, GraphEdge[]>();
  const byObject = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!bySupplier.has(e.subject_id)) bySupplier.set(e.subject_id, []);
    bySupplier.get(e.subject_id)!.push(e);
    const k = e.object.toLowerCase();
    if (!byObject.has(k)) byObject.set(k, new Set());
    byObject.get(k)!.add(e.subject_id);
  }
  const shared = new Set([...byObject.entries()].filter(([, v]) => v.size > 1).map(([k]) => k));

  // Suppliers ride the circle. Sorting by degree and placing in order would sit
  // the two busiest hubs side by side and pile their leaves on top of each
  // other, so the sorted list is dealt alternately to opposite sides instead:
  // the busiest goes to 12 o'clock, the second to 6, and so on inward.
  const ranked = [...bySupplier.entries()].sort((a, b) => b[1].length - a[1].length).map(([id, es]) => ({ id, es }));
  const n = ranked.length;
  const slot: (typeof ranked)[number][] = new Array(n);
  let lo = 0;
  let hi = Math.ceil(n / 2);
  ranked.forEach((s, i) => { slot[i % 2 === 0 ? lo++ : hi++] = s; });
  const suppliers = slot.filter(Boolean);
  const hubAngle = new Map<string, number>();
  suppliers.forEach((s, i) => hubAngle.set(s.id, (i / n) * Math.PI * 2 - Math.PI / 2));

  // Shared objects sit in the middle, at the mean angle of the suppliers on them.
  const bridgePos = new Map<string, Node>();
  [...shared].forEach((k, i) => {
    const holders = [...byObject.get(k)!];
    const angles = holders.map((h) => hubAngle.get(h) ?? 0);
    const mx = angles.reduce((a, x) => a + Math.cos(x), 0) / angles.length;
    const my = angles.reduce((a, x) => a + Math.sin(x), 0) / angles.length;
    const mean = Math.atan2(my, mx);
    bridgePos.set(k, pol(mean, R_BRIDGE + (i % 2) * 34));
  });

  // Private objects fan out in the angular slice that belongs to their supplier.
  const leafPos = new Map<string, Node>();
  const slice = (Math.PI * 2) / n;
  for (const s of suppliers) {
    const base = hubAngle.get(s.id)!;
    const priv = s.es.filter((e) => !shared.has(e.object.toLowerCase()));
    priv.forEach((e, i) => {
      const off = priv.length === 1 ? 0 : ((i / (priv.length - 1)) - 0.5) * slice * (priv.length > 5 ? 0.94 : 0.7);
      const r = R_LEAF + (i % 4) * 34;
      leafPos.set(`${s.id}|${e.object}`, pol(base + off, r));
    });
  }

  return (
    <figure className="card overflow-hidden p-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img"
           aria-label={`Knowledge graph: ${edges.length} edges across ${suppliers.length} suppliers and ${byObject.size} objects`}>
        <rect width={W} height={H} fill="var(--surface)" />

        {/* Edges first, so nodes sit on top. */}
        <g strokeLinecap="round" fill="none">
          {suppliers.map((s) => {
            const hub = pol(hubAngle.get(s.id)!, R_HUB);
            return s.es.map((e) => {
              const k = e.object.toLowerCase();
              const target = shared.has(k) ? bridgePos.get(k)! : leafPos.get(`${s.id}|${e.object}`);
              if (!target) return null;
              const tint = PRED_TINT[e.predicate] ?? "var(--muted)";
              const isBridge = shared.has(k);
              return (
                <path
                  key={`${s.id}-${e.predicate}-${e.object}`}
                  d={curve(hub, target, isBridge ? 0.34 : 0.1)}
                  stroke={tint}
                  strokeWidth={isBridge ? 1.9 : 1}
                  opacity={isBridge ? 0.85 : 0.42}
                />
              );
            });
          })}
        </g>

        {/* Private objects. */}
        <g>
          {suppliers.map((s) =>
            s.es
              .filter((e) => !shared.has(e.object.toLowerCase()))
              .map((e) => {
                const p = leafPos.get(`${s.id}|${e.object}`);
                if (!p) return null;
                const tint = PRED_TINT[e.predicate] ?? "var(--muted)";
                const left = p.x < CX;
                return (
                  <g key={`leaf-${s.id}-${e.predicate}-${e.object}`}>
                    <title>{`${e.object} — ${e.predicate.replace(/_/g, " ")}`}</title>
                    <circle cx={p.x} cy={p.y} r={3.4} fill={tint} opacity={0.9} />
                    <text
                      x={left ? p.x - 6 : p.x + 6}
                      y={p.y + 3}
                      textAnchor={left ? "end" : "start"}
                      fontSize="10.5"
                      fill="var(--muted)"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {short(e.object, 17)}
                    </text>
                  </g>
                );
              }),
          )}
        </g>

        {/* Suppliers. */}
        <g>
          {suppliers.map((s) => {
            const p = pol(hubAngle.get(s.id)!, R_HUB);
            const name = s.es[0]?.subject_name ?? s.id;
            const left = p.x < CX;
            return (
              <g key={`hub-${s.id}`}>
                <title>{`${name} — ${s.es.length} edge${s.es.length === 1 ? "" : "s"}`}</title>
                <circle cx={p.x} cy={p.y} r={5 + Math.min(s.es.length, 9)} fill="var(--ink)" opacity={0.92} />
                <text
                  x={left ? p.x - 14 : p.x + 14}
                  y={p.y + 4}
                  textAnchor={left ? "end" : "start"}
                  fontSize="12"
                  fontWeight={600}
                  fill="var(--ink)"
                >
                  {short(name, 22)}
                </text>
              </g>
            );
          })}
        </g>

        {/* The four bridges, labelled, because they are the point. */}
        <g>
          {[...shared].map((k) => {
            const p = bridgePos.get(k)!;
            const holders = byObject.get(k)!;
            const label = edges.find((e) => e.object.toLowerCase() === k)?.object ?? k;
            return (
              <g key={`bridge-${k}`}>
                <title>{`${label} — shared by ${holders.size} suppliers`}</title>
                <circle cx={p.x} cy={p.y} r={9} fill="var(--accent)" />
                <circle cx={p.x} cy={p.y} r={15} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.45} />
                <text x={p.x} y={p.y - 22} textAnchor="middle" fontSize="12.5" fontWeight={600} fill="var(--accent)">
                  {label}
                </text>
                <text x={p.x} y={p.y + 30} textAnchor="middle" fontSize="10.5" fill="var(--muted)"
                      style={{ fontFamily: "var(--font-mono)" }}>
                  {holders.size} suppliers
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <figcaption className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t px-5 py-3 text-xs"
                  style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {Object.entries({ certified_by: "certified by", meets_standard: "meets standard", distributes_brand: "distributes brand", part_of_group: "part of group", makes_with_material: "material", uses_process: "process" }).map(([k, label]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: PRED_TINT[k] }} />
              {label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--accent)" }} />
            shared by more than one supplier
          </span>
        </span>
        <span className="mono">
          {suppliers.length} suppliers · {byObject.size} objects · {edges.length} edges · {shared.size} shared
        </span>
      </figcaption>
    </figure>
  );
}
