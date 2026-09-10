import Link from "next/link";
import { stats, supplierList } from "@/lib/queries";
import { Ar, ClassBadge, Investigated, Legend, Registry } from "@/components/ui";
import { fmtInt } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Suppliers" };

const FAMILIES = ["valve", "pump", "fitting"];
const CLASSES = ["manufacturer", "assembler", "authorised_distributor", "trader"];
const VERDICTS = ["supported", "pending", "refuted"];
const REGISTRIES: [string, string][] = [
  ["tarmeez", "Tarmeez"],
  ["mlcp", "MLCP"],
  ["made_in_saudi", "Made in Saudi"],
  ["discovered", "Outside Tarmeez"],
];

const field = "rounded-md border px-2 py-1 text-sm transition-colors";

function Sel({ name, options, label, value }: { name: string; options: [string, string][]; label: string; value?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="eyebrow">{label}</span>
      <select name={name} defaultValue={value ?? ""} className={field} style={{ borderColor: "var(--line)", color: "var(--ink)", background: "var(--surface)" }}>
        <option value="">any</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

/* The tile that opens each row. Manufacturers and assemblers get the plant
   glyph, distributors and traders the carton — the class is legible before you
   read a word, which is what the reference does with the same two shapes. */
function ClassTile({ cls }: { cls: string | null }) {
  const makes = cls === "manufacturer" || cls === "assembler";
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <span
      aria-hidden
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
      style={{ background: "var(--chip)", color: "var(--muted)" }}
    >
      {makes ? (
        <svg viewBox="0 0 18 18" width="17" height="17" {...stroke}>
          <path d="M2.6 15.2V7.6l4.2 2.6V7.6l4.2 2.6V4.2l4.4 11z" />
        </svg>
      ) : (
        <svg viewBox="0 0 18 18" width="17" height="17" {...stroke}>
          <path d="M9 2.4 15.4 5.7v6.6L9 15.6 2.6 12.3V5.7z" />
          <path d="m2.6 5.7 6.4 3.3 6.4-3.3M9 9v6.6" />
        </svg>
      )}
    </span>
  );
}

/* A count shown as a proportion, never as a score. The brief forbids inventing
   a number, so this is only ever "how many of this supplier's claims survived
   the Auditor" — a fact, with its denominator kept visible beside it. */
function Supported({ n, of }: { n: number; of: number }) {
  const share = of > 0 ? n / of : 0;
  const tone = n === 0 ? "var(--faint)" : share >= 0.5 ? "var(--ok)" : "var(--warn)";
  return (
    <span className="flex items-center gap-2.5">
      <span className="mono text-sm font-semibold" style={{ color: tone }}>{n}</span>
      <span className="relative block h-1.5 w-16 overflow-hidden rounded-full" style={{ background: "var(--chip)" }}>
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(share * 100, n ? 6 : 0)}%`, background: tone }} />
      </span>
      <span className="mono text-[0.6875rem]" style={{ color: "var(--faint)" }}>of {of}</span>
    </span>
  );
}

/* Certificates and standards on record, from the relations graph — the
   Specifier writes these as certified_by and meets_standard edges, each with
   the page it read them from. Only a handful of suppliers carry any, so the
   cell is empty far more often than not; an empty cell means nothing has been
   established, never that the supplier holds nothing. */
function Standards({ list }: { list: string[] }) {
  if (!list.length) return <span className="text-[0.6875rem]" style={{ color: "var(--faint)" }} title="No certificate or standard on record yet. This is an absence of evidence, not evidence of absence.">not on record</span>;
  const shown = list.slice(0, 3);
  const rest = list.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((v) => (
        <span
          key={v}
          className="mono inline-flex items-center rounded px-1.5 py-0.5 text-[0.6875rem] leading-tight"
          style={{ background: "var(--chip)", color: "var(--ink-soft)" }}
          title={v}
        >
          {v.length > 22 ? `${v.slice(0, 21)}…` : v}
        </span>
      ))}
      {rest > 0 && (
        <span className="mono text-[0.6875rem]" style={{ color: "var(--faint)" }} title={list.join(" · ")}>
          +{rest}
        </span>
      )}
    </span>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const f = await searchParams;
  const page = Math.max(Number(f.page ?? 1) || 1, 1);
  const perPage = 100;
  const [rows, s] = await Promise.all([
    supplierList({ family: f.family, region: f.region, cls: f.cls, verdict: f.verdict, registry: f.registry, q: f.q, page, perPage }),
    stats(),
  ]);
  const total = rows[0]?.total ?? 0;
  const pages = Math.max(Math.ceil(total / perPage), 1);
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const filtered = Boolean(f.family || f.cls || f.verdict || f.registry || f.q);

  const qs = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v && k !== "page") u.set(k, v);
    if (p > 1) u.set("page", String(p));
    const str = u.toString();
    return str ? `/suppliers?${str}` : "/suppliers";
  };

  return (
    <div className="space-y-5">
      {/* The headline: how big the map is, and how much of it this view holds.
          A list that silently shows 300 of 14,329 invites the reader to think
          that is all there is. */}
      <section className="card flex flex-wrap items-end gap-x-10 gap-y-5 p-5">
        <div>
          <div className="eyebrow">Suppliers on the map</div>
          <div className="mono mt-1 text-5xl font-semibold leading-none">{fmtInt(s.suppliers)}</div>
          <p className="mt-1.5 text-xs" style={{ color: "var(--muted)" }}>
            every company on record, from Tarmeez, MLCP, Made in Saudi and the hunt
          </p>
        </div>
        <div>
          <div className="eyebrow">{filtered ? "Matching these filters" : "With a capability on record"}</div>
          <div className="mono mt-1 text-5xl font-semibold leading-none" style={{ color: "var(--accent)" }}>
            {fmtInt(total)}
          </div>
          <p className="mt-1.5 text-xs" style={{ color: "var(--muted)" }}>
            showing <span className="mono">{fmtInt(from)}</span>&ndash;<span className="mono">{fmtInt(to)}</span>
            {pages > 1 ? <> · page <span className="mono">{page}</span> of <span className="mono">{pages}</span></> : null}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="eyebrow">Investigated by a Detective</div>
          <div className="mono mt-1 text-5xl font-semibold leading-none" style={{ color: "var(--ok)" }}>
            {fmtInt(s.investigated)}
          </div>
          <p className="mt-1.5 max-w-md text-xs" style={{ color: "var(--muted)" }}>
            the rest carry registry declarations that no agent has checked yet
          </p>
        </div>
      </section>

      <form className="card flex flex-wrap items-end gap-4 p-4">
        <Sel name="family" label="Family" value={f.family} options={FAMILIES.map((x) => [x, x] as [string, string])} />
        <Sel name="cls" label="Class" value={f.cls} options={CLASSES.map((x) => [x, x.replace(/_/g, " ")] as [string, string])} />
        <Sel name="verdict" label="Verdict" value={f.verdict} options={VERDICTS.map((x) => [x, x] as [string, string])} />
        <Sel name="registry" label="Registry" value={f.registry} options={REGISTRIES} />
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Name or CR</span>
          <input name="q" defaultValue={f.q ?? ""} className={field} style={{ borderColor: "var(--line)", background: "var(--surface)" }} />
        </label>
        <button className="rounded-md px-4 py-1.5 text-sm font-medium transition-opacity hover:opacity-90" style={{ background: "var(--ink)", color: "var(--paper)" }}>
          Filter
        </button>
      </form>

      <Legend />

      {/* Rows rather than table cells: each supplier is one record with its own
          internal hierarchy — name, then identity, then what we can stand
          behind — which a flat grid of columns flattens away. */}
      <div className="card overflow-hidden">
        <div
          className="hidden grid-cols-[minmax(0,1fr)_220px_auto_180px_140px] items-center gap-6 border-b px-4 py-2 text-[0.6875rem] font-semibold uppercase tracking-wider lg:grid"
          style={{ background: "var(--sunken)", borderColor: "var(--line)", color: "var(--faint)" }}
        >
          <span>Supplier</span>
          <span>Certificates and standards</span>
          <span>Registries</span>
          <span>Supported capabilities</span>
          <span>Investigated</span>
        </div>

        {rows.length === 0 && (
          <p className="px-4 py-10 text-center text-sm" style={{ color: "var(--muted)" }}>
            Nothing matches those filters.
          </p>
        )}

        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/suppliers/${encodeURIComponent(r.id)}`}
            className="data-row grid grid-cols-1 items-center gap-x-6 gap-y-3 border-b px-4 py-3 transition-colors last:border-b-0 lg:grid-cols-[minmax(0,1fr)_220px_auto_180px_140px]"
            style={{ borderColor: "var(--line)" }}
          >
            <span className="flex min-w-0 items-center gap-3">
              <ClassTile cls={r.best_class} />
              <span className="min-w-0">
                <span className="block truncate text-[0.95rem] font-medium">{r.name_en ?? r.id}</span>
                <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--muted)" }}>
                  <Ar s={r.name_ar} />
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem]" style={{ color: "var(--faint)" }}>
                  {r.city_en && <span>{r.city_en}</span>}
                  {r.best_class && (
                    <>
                      <span aria-hidden>·</span>
                      <ClassBadge c={r.best_class} />
                    </>
                  )}
                  {r.cr_number && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="mono" dir="ltr">CR {r.cr_number}</span>
                    </>
                  )}
                </span>
              </span>
            </span>

            <span><Standards list={r.standards} /></span>
            <span><Registry tarmeez={r.in_tarmeez} mlcp={r.in_mlcp} mis={r.in_made_in_saudi} source={r.source} /></span>
            <span><Supported n={r.supported_count} of={r.capability_count} /></span>
            <span><Investigated s={r.detective_status} /></span>
          </Link>
        ))}
      </div>

      {/* The pager. The full sort over 14,329 suppliers runs in about 140ms, so
          paging is a reading decision rather than a performance one: 100 rows is
          what a person can scan, not what the database can manage. */}
      {pages > 1 && (
        <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Pagination">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            <span className="mono">{fmtInt(from)}</span>&ndash;<span className="mono">{fmtInt(to)}</span> of{" "}
            <span className="mono">{fmtInt(total)}</span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Pager href={qs(1)} disabled={page === 1} label="First" />
            <Pager href={qs(page - 1)} disabled={page === 1} label="Previous" />
            {pageWindow(page, pages).map((n, i) =>
              n === null ? (
                <span key={`gap-${i}`} className="mono px-1 text-xs" style={{ color: "var(--faint)" }}>…</span>
              ) : (
                <Link
                  key={n}
                  href={qs(n)}
                  aria-current={n === page ? "page" : undefined}
                  className="mono rounded border px-2.5 py-1 text-xs transition-colors"
                  style={n === page
                    ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" }
                    : { background: "var(--surface)", color: "var(--ink-soft)", borderColor: "var(--line)" }}
                >
                  {n}
                </Link>
              ),
            )}
            <Pager href={qs(page + 1)} disabled={page === pages} label="Next" />
            <Pager href={qs(pages)} disabled={page === pages} label="Last" />
          </div>
        </nav>
      )}
    </div>
  );
}

function Pager({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  const style = { borderColor: "var(--line)", background: "var(--surface)", color: disabled ? "var(--faint)" : "var(--ink-soft)" };
  if (disabled) return <span className="rounded border px-2.5 py-1 text-xs" style={style}>{label}</span>;
  return <Link href={href} className="rounded border px-2.5 py-1 text-xs transition-colors hover:bg-[var(--chip)]" style={style}>{label}</Link>;
}

/* First, last, and a window around the current page, with gaps marked null. */
function pageWindow(page: number, pages: number): (number | null)[] {
  const keep = new Set<number>([1, pages, page, page - 1, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((n) => keep.add(n));
  const list = [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  let prev = 0;
  for (const n of list) {
    if (prev && n - prev > 1) out.push(null);
    out.push(n);
    prev = n;
  }
  return out;
}
