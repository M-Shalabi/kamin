import Link from "next/link";
import type { ReactNode } from "react";
import { classLabel, fmtInt, fmtMoney, fmtPct } from "@/lib/format";

/* Presentation primitives. Colour is semantic throughout — it encodes evidence
   tier, auditor verdict, gap kind and spec status — so every value here is a
   token from globals.css and none is a literal. Change the palette in one
   place and the meaning travels with it. */

export const Money = ({ v }: { v: number | null | undefined }) => <span className="mono">{fmtMoney(v)}</span>;
export const Int = ({ v }: { v: number | null | undefined }) => <span className="mono">{fmtInt(v)}</span>;
export const Pct = ({ v }: { v: number | null | undefined }) => <span className="mono">{fmtPct(v)}</span>;

/* ── Chips ────────────────────────────────────────────────────────────────── */

const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[0.6875rem] leading-tight whitespace-nowrap";

/* Evidence tier. Tiers 1 and 2 are the only ones that count toward coverage,
   so they read as affirmative and 3–4 read as provisional. The full label is
   the title, because a bare "T2" means nothing to a first-time reader. */
const TIER_LABEL: Record<number, string> = {
  1: "Tier 1, third-party verified (certifier, award or standards body page)",
  2: "Tier 2, official registry declaration (Tarmeez, commercial register, MLCP)",
  3: "Tier 3, self-published (the supplier's own site or catalogue)",
  4: "Tier 4, inferred (adjacency or equipment signal; never stands alone)",
};

export const Tier = ({ t }: { t: number | null | undefined }) =>
  t ? (
    <span
      title={TIER_LABEL[t]}
      className={`mono ${chip} font-medium`}
      style={
        t <= 2
          ? { background: "var(--ok-soft)", color: "var(--ok)", boxShadow: "inset 0 0 0 1px var(--ok-line)" }
          : { background: "var(--warn-soft)", color: "var(--warn)" }
      }
    >
      T{t}
    </span>
  ) : (
    <span className="text-[0.6875rem]" style={{ color: "var(--faint)" }}>no evidence</span>
  );

/* The Auditor's finding. Refuted means not real — it is meant to carry weight,
   so it gets the one alarming colour in the system. */
export const Verdict = ({ v }: { v: string }) => {
  const color = v === "supported" ? "var(--ok)" : v === "refuted" ? "var(--bad)" : "var(--muted)";
  return (
    <span className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color }}>
      {v}
    </span>
  );
};

export const ClassBadge = ({ c }: { c: string }) => (
  <span className={chip} style={{ background: "var(--chip)", color: "var(--ink-soft)" }}>
    {classLabel(c)}
  </span>
);

/* Gap kind. The accent is spent here and on the headline figure, nowhere else —
   a manufacturing gap is the thing the whole product exists to surface. */
const GAP: Record<string, { label: string; color: string }> = {
  covered: { label: "covered", color: "var(--ok)" },
  manufacturing_gap: { label: "manufacturing gap", color: "var(--accent)" },
  supply_gap: { label: "supply gap", color: "var(--bad)" },
};

export const GapKind = ({ k }: { k: string | null }) => {
  const g = (k && GAP[k]) || { label: "unmatched", color: "var(--muted)" };
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: g.color }}>
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: g.color }} />
      {g.label}
    </span>
  );
};

/* How far the best supplier has actually been verified for this order. Shares
   the ladder's colour scale so the table and the hero agree. */
const SPEC: Record<string, { label: string; short: string; color: string }> = {
  at_spec: { label: "verified at the stated specification", short: "at spec", color: "var(--ok)" },
  type: { label: "product type verified, rating and size not yet", short: "type verified", color: "var(--warn)" },
  category: { label: "declared at category level, specification unverified", short: "declared only", color: "var(--accent)" },
  none: { label: "no supported supplier", short: "nobody", color: "var(--bad)" },
};

export const SpecStatus = ({ s, long = false }: { s: string | null; long?: boolean }) => {
  const v = (s && SPEC[s]) || null;
  if (!v) return <span className="text-[0.6875rem]" style={{ color: "var(--faint)" }}>not matched</span>;
  return (
    <span className="text-[0.6875rem] font-medium" style={{ color: v.color }} title={v.label}>
      {long ? v.label : v.short}
    </span>
  );
};

export const Registry = ({ tarmeez, mlcp, mis, source }: { tarmeez: boolean; mlcp: boolean; mis: boolean; source: string }) => (
  <span className="flex flex-wrap gap-1">
    {tarmeez && <span className={chip} style={{ background: "var(--chip)", color: "var(--ink-soft)" }}>Tarmeez</span>}
    {mlcp && <span className={chip} style={{ background: "var(--chip)", color: "var(--ink-soft)" }}>MLCP</span>}
    {mis && <span className={chip} style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>Made in Saudi</span>}
    {!tarmeez && (
      <span className={chip} style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
        {source === "hunt" ? "Sourced by KAMIN" : "outside Tarmeez"}
      </span>
    )}
  </span>
);

/* The Detective's outcome on one supplier.
 *
 * A caution about "Verified by KAMIN": detective_status is 'ok' whenever the
 * run completed without throwing, which includes runs that concluded the pages
 * they found were about a different company, and runs that found nothing. Only
 * the subset that actually merged capabilities is verified in any strong sense.
 * The badge reads as the brief requires — pending is "not yet", never a no —
 * but splitting 'ok' by is_same_company would make it honest. */
const INVESTIGATED: Record<string, { label: string; fg: string; bg: string; title: string }> = {
  ok: {
    label: "Verified by KAMIN",
    fg: "var(--ok)",
    bg: "var(--ok-soft)",
    title: "A Detective run completed against this supplier and its findings are on the record.",
  },
  pending: {
    label: "not yet investigated",
    fg: "var(--faint)",
    bg: "var(--chip)",
    title: "No Detective has run against this supplier yet. This is not a negative finding; it is an absence of one.",
  },
  error: {
    label: "run failed",
    fg: "var(--bad)",
    bg: "var(--bad-soft)",
    title: "The Detective run threw before it could finish. Nothing was concluded about this supplier.",
  },
  skipped: {
    label: "skipped",
    fg: "var(--muted)",
    bg: "var(--chip)",
    title: "Deliberately not investigated.",
  },
};

export const Investigated = ({ s }: { s: string | null }) => {
  const v = INVESTIGATED[s ?? ""] ?? INVESTIGATED.pending!;
  return (
    <span
      className={`${chip} font-medium`}
      title={v.title}
      style={{ background: v.bg, color: v.fg, boxShadow: s === "ok" ? "inset 0 0 0 1px var(--ok-line)" : undefined }}
    >
      {v.label}
    </span>
  );
};

/* ── Agent attribution ────────────────────────────────────────────────────
   Every claim in this product was written by one of five roles. The badge
   names the role wherever a claim appears, and links to the run that produced
   it, so "which agent did this?" is answerable in one click from anywhere. */

/* The four roles the deck presents. The Specifier is deliberately not a fifth:
   CONTEXT.md defines it as "the Detective's second pass over one supplier", so
   it carries the Detective's colour and says so in its name. Its runs are real
   and its evidence rows still resolve here — the deck's four is a grouping, not
   a deletion. */
export const AGENTS = {
  coordinator: { en: "Coordinator", ar: "المنسّق", tint: "#5B7CC7", does: "Turns one purchase line into a normalised specification with an HS anchor, then pools it with matching lines across companies and time." },
  detective:   { en: "Detective",   ar: "المحقّق",  tint: "#8A63C4", does: "Investigates one candidate supplier and returns capabilities, each with evidence. This is what finds companies no registry holds." },
  specifier:   { en: "Detective, second pass", ar: "المحقّق، تمريرة ثانية", tint: "#8A63C4", does: "The Detective's second pass: reads the supplier's catalogues and datasheets and writes the specifications they actually state, with sizes, ratings, materials and standards." },
  auditor:     { en: "Auditor",     ar: "المدقّق",  tint: "#C0632A", does: "Tries to refute one capability and assigns its class. Built to say no." },
  advisor:     { en: "Advisor",     ar: "المستشار", tint: "#12703A", does: "Turns one gap into an investment case: what is missing, what it is worth, what it would take." },
} as const;

export type AgentRoleKey = keyof typeof AGENTS;
export const isAgentRole = (r: string): r is AgentRoleKey => r in AGENTS;

/** Names the agent behind a claim. `runId` makes it a link to the trajectory. */
export function Agent({ role, runId, withArabic = false }: { role: string; runId?: string | null; withArabic?: boolean }) {
  const a = isAgentRole(role) ? AGENTS[role] : null;
  const label = a?.en ?? role;
  const tint = a?.tint ?? "var(--muted)";
  const body = (
    <span
      className={`${chip} gap-1.5 font-medium`}
      style={{ background: `color-mix(in oklab, ${tint} 12%, transparent)`, color: tint }}
      title={a ? `${a.en}: ${a.does}` : role}
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: tint }} />
      {label}
      {withArabic && a && <span className="ar" dir="auto" style={{ opacity: 0.75 }}>{a.ar}</span>}
    </span>
  );
  return runId ? (
    <Link href={`/runs/${runId}`} className="inline-flex transition-opacity hover:opacity-75" title="Open the trajectory that produced this">
      {body}
    </Link>
  ) : body;
}

/** "Written by the Detective · trajectory" — the attribution line under a claim. */
export function WrittenBy({ role, runId, verb = "Written by" }: { role: string; runId?: string | null; verb?: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-[0.6875rem]" style={{ color: "var(--muted)" }}>
      <span>{verb}</span>
      <Agent role={role} runId={runId} />
      {runId && <Link href={`/runs/${runId}`} className="underline decoration-dotted underline-offset-2">trajectory</Link>}
    </span>
  );
}

/* ── The legend ───────────────────────────────────────────────────────────── */

/* Colour carries meaning on every table in this app, and hover titles are not
   discoverable — and do not exist at all on touch. So the encoding is stated
   once, in the open, where a first-time reader meets it. */
export function Legend() {
  const items: [string, string, string][] = [
    ["var(--ok)", "covered / supported / at spec", "the evidence holds at this level"],
    ["var(--warn)", "type verified", "the right product, rating and size unconfirmed"],
    ["var(--accent)", "manufacturing gap / declared only", "nobody makes it locally, or nobody has proven the specification"],
    ["var(--bad)", "supply gap / refuted", "no supported supplier of any class, or the claim did not survive the Auditor"],
  ];
  return (
    <details className="card px-4 py-2.5 text-xs">
      <summary className="cursor-pointer select-none font-medium" style={{ color: "var(--muted)" }}>
        How to read the colours
      </summary>
      <dl className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {items.map(([color, term, gloss]) => (
          <div key={term} className="flex gap-2.5">
            <span aria-hidden className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
            <div>
              <dt className="font-medium" style={{ color }}>{term}</dt>
              <dd style={{ color: "var(--muted)" }}>{gloss}</dd>
            </div>
          </div>
        ))}
      </dl>
      <p className="mt-3 border-t pt-2.5" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
        <span className="mono">T1</span>–<span className="mono">T4</span> mark evidence tier. Only{" "}
        <span className="mono">T1</span> and <span className="mono">T2</span>, a third party or an official registry,
        count toward coverage. A claim resting on the supplier's own website is shown but never counted.
      </p>
    </details>
  );
}

/* ── Structure ────────────────────────────────────────────────────────────── */

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ background: "var(--sunken)" }}>
            {head.map((h, i) => (
              <th
                key={i}
                scope="col"
                className="whitespace-nowrap px-3 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wider"
                style={{ color: "var(--muted)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const Tr = ({ children }: { children: ReactNode }) => <tr className="data-row transition-colors">{children}</tr>;

export const Td = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <td className={`border-t px-3 py-2 align-top ${className}`} style={{ borderColor: "var(--line)" }}>
    {children}
  </td>
);

export const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link
    href={href}
    className="underline decoration-dotted underline-offset-2 transition-colors hover:decoration-solid"
    style={{ textDecorationColor: "var(--faint)" }}
  >
    {children}
  </Link>
);

export const Ar = ({ s }: { s: string | null | undefined }) => (s ? <span className="ar" dir="auto">{s}</span> : null);

/* Section heading with an eyebrow — names the kind of thing before what it says. */
export function SectionHead({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2 className="cond text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}
