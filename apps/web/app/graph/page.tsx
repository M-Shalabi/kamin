import Link from "next/link";
import { graphEdges } from "@/lib/queries";
import { SectionHead } from "@/components/ui";
import { GraphMap } from "@/components/GraphMap";
import { fmtInt } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Relations" };

/* The knowledge graph, read from the object side.
 *
 * Grouping by object rather than by supplier is what makes it a graph and not a
 * list of attributes: the interesting question is "who else holds ISO 9001",
 * "who else distributes Grundfos", "who else is inside the Olayan group", and
 * that is a column of suppliers under one object. Every edge keeps the page it
 * was read from. */

const PRED: Record<string, { en: string; ar: string; gloss: string; tint: string }> = {
  certified_by:        { en: "Certified by",       ar: "معتمد من",     gloss: "A certifier or standards body the company holds a certificate from.", tint: "#12703A" },
  meets_standard:      { en: "Meets standard",     ar: "يستوفي معيار", gloss: "A standard the company's lines are stated to conform to.",           tint: "#0F8A8A" },
  distributes_brand:   { en: "Distributes brand",  ar: "يوزّع علامة",   gloss: "A brand the company resells or represents.",                        tint: "#5B7CC7" },
  part_of_group:       { en: "Part of group",      ar: "جزء من مجموعة", gloss: "A parent, holding or group the company belongs to.",                tint: "#8A63C4" },
  same_entity_as:      { en: "Same entity as",     ar: "نفس الكيان",   gloss: "Another name the same company trades under.",                       tint: "#8A63C4" },
  makes_with_material: { en: "Works in material",  ar: "يعمل بمادة",   gloss: "A material the company states it works in.",                        tint: "#C0632A" },
  uses_process:        { en: "Runs process",       ar: "يشغّل عملية",   gloss: "A process the company states it runs.",                             tint: "#C0632A" },
};

const ORDER = ["certified_by", "meets_standard", "distributes_brand", "part_of_group", "same_entity_as", "makes_with_material", "uses_process"];

export default async function Page() {
  const edges = await graphEdges();
  const subjects = new Set(edges.map((e) => e.subject_id));
  const objects = new Set(edges.map((e) => e.object.toLowerCase()));
  const linked = edges.filter((e) => e.object_id).length;

  // predicate -> object -> the suppliers on that edge
  const grouped = new Map<string, Map<string, typeof edges>>();
  for (const e of edges) {
    if (!grouped.has(e.predicate)) grouped.set(e.predicate, new Map());
    const byObject = grouped.get(e.predicate)!;
    if (!byObject.has(e.object)) byObject.set(e.object, []);
    byObject.get(e.object)!.push(e);
  }

  return (
    <div className="space-y-7">
      <section>
        <SectionHead eyebrow="The knowledge graph" title="Typed edges, each with the page it came from">
          <p className="mono text-xs" style={{ color: "var(--muted)" }}>
            {fmtInt(edges.length)} edges · {fmtInt(subjects.size)} suppliers · {fmtInt(objects.size)} objects
          </p>
        </SectionHead>
        <p className="max-w-4xl text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          Suppliers, capabilities and evidence are already a graph. These are the edges on top of it: what a
          company is certified by, which brands it distributes, which group it belongs to, which standards its
          lines meet. Grouped here by the thing pointed at, because the question a registry cannot answer is{" "}
          <em>who else</em>.
        </p>
      </section>

      <GraphMap edges={edges} />

      {/* The one honest caveat, stated where it is relevant rather than hidden. */}
      <section className="card p-4" style={{ borderColor: "var(--line-strong)" }}>
        <div className="eyebrow">Known limitation</div>
        <p className="mt-1 max-w-4xl text-sm leading-relaxed">
          <span className="mono font-semibold">{linked}</span> of{" "}
          <span className="mono font-semibold">{edges.length}</span> edges resolve to another supplier on the map.
          Group and same-entity objects are matched by name, and the matcher keys on the first word, which never
          resolves in a country where thousands of companies begin with &ldquo;Saudi&rdquo; or &ldquo;Al&rdquo;.
          So this is currently a star of supplier to free text, not a network you can walk.
        </p>
      </section>

      <SectionHead eyebrow="Every edge" title="The same graph, read as a list" />

      {ORDER.filter((p) => grouped.has(p)).map((predicate) => {
        const byObject = grouped.get(predicate)!;
        const meta = PRED[predicate] ?? { en: predicate, ar: "", gloss: "", tint: "var(--muted)" };
        const total = [...byObject.values()].reduce((a, v) => a + v.length, 0);
        return (
          <section key={predicate} className="card overflow-hidden">
            <div
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b px-5 py-3"
              style={{ background: `color-mix(in oklab, ${meta.tint} 7%, transparent)`, borderColor: "var(--line)" }}
            >
              <div className="flex flex-wrap items-baseline gap-2.5">
                <span className="cond text-lg font-semibold" style={{ color: meta.tint }}>{meta.en}</span>
                <span className="ar text-sm" dir="auto" style={{ color: "var(--muted)" }}>{meta.ar}</span>
              </div>
              <span className="mono text-[0.6875rem]" style={{ color: "var(--muted)" }}>
                {total} edge{total === 1 ? "" : "s"} · {byObject.size} object{byObject.size === 1 ? "" : "s"}
              </span>
            </div>

            <p className="px-5 pt-3 text-xs" style={{ color: "var(--muted)" }}>{meta.gloss}</p>

            <ul className="divide-y px-5 py-3" style={{ borderColor: "var(--line)" }}>
              {[...byObject.entries()].map(([object, list]) => (
                <li key={object} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:gap-6">
                  <span className="shrink-0 sm:w-[280px]">
                    <span
                      className="mono inline-block rounded px-1.5 py-0.5 text-xs"
                      style={{ background: "var(--chip)", color: "var(--ink-soft)" }}
                    >
                      {object}
                    </span>
                    {list.length > 1 && (
                      <span className="mono ml-2 text-[0.6875rem]" style={{ color: meta.tint }}>
                        ×{list.length}
                      </span>
                    )}
                  </span>

                  <span className="min-w-0 flex-1 space-y-1">
                    {list.map((e) => (
                      <span key={`${e.subject_id}:${e.object}`} className="block text-sm">
                        <Link
                          href={`/suppliers/${encodeURIComponent(e.subject_id)}`}
                          className="underline decoration-dotted underline-offset-2"
                          style={{ textDecorationColor: "var(--faint)" }}
                        >
                          {e.subject_name}
                        </Link>
                        {e.source_url && (
                          <>
                            {" "}
                            <a
                              href={e.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[0.6875rem] underline"
                              style={{ color: "var(--muted)" }}
                              title={e.source_url}
                            >
                              source
                            </a>
                          </>
                        )}
                        {e.excerpt && (
                          <span className="mt-0.5 block text-xs italic" style={{ color: "var(--muted)" }} dir="auto">
                            &ldquo;{e.excerpt.length > 180 ? `${e.excerpt.slice(0, 179)}…` : e.excerpt}&rdquo;
                          </span>
                        )}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
