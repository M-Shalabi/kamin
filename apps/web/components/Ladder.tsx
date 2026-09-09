import { fmtMoney, fmtPct } from "@/lib/format";

/**
 * The coverage ladder — the central argument of the product, drawn.
 *
 * Three readings of the same question, each stricter than the last. A registry
 * lookup says the Kingdom covers almost everything; checking the actual size,
 * rating and material says it covers a fraction. The collapse between the rungs
 * is the finding, so it is drawn as a physical drain: full-width bar, then most
 * of it gone, then almost nothing left. The bars animate in sequence on load,
 * which makes the collapse something you watch rather than something you read.
 *
 * Presentation only — every figure arrives from coverageSummary().
 */

type Summary = {
  coverage: number;
  coverage_type: number;
  coverage_spec: number;
  line_coverage: number;
  line_coverage_type: number;
  line_coverage_spec: number;
  spend_total: number;
  line_total: number;
};

type Rung = {
  key: string;
  share: number;
  lines: number;
  label: string;
  gloss: string;
  tone: "ok" | "warn" | "accent";
};

const TONE: Record<Rung["tone"], { bar: string; text: string }> = {
  accent: { bar: "var(--accent)", text: "var(--accent)" },
  warn: { bar: "var(--warn)", text: "var(--warn)" },
  ok: { bar: "var(--ok)", text: "var(--ok)" },
};

export function Ladder({ c, compact = false }: { c: Summary; compact?: boolean }) {
  const rungs: Rung[] = [
    {
      key: "category",
      share: c.coverage,
      lines: c.line_coverage,
      label: "Declared at category level",
      gloss: "A verified supplier declares the tariff subheading, nothing in conflict. No specification on record.",
      tone: "ok",
    },
    {
      key: "type",
      share: c.coverage_type,
      lines: c.line_coverage_type,
      label: "Product type verified",
      gloss: "The supplier names the actual product type with nothing in conflict — but size and rating are unconfirmed.",
      tone: "warn",
    },
    {
      key: "spec",
      share: c.coverage_spec,
      lines: c.line_coverage_spec,
      label: "Verified at the stated specification",
      gloss: "The supplier states attributes that agree with what the order demands, and none that conflict. This is the honest number.",
      tone: "accent",
    },
  ];

  return (
    <section aria-labelledby="ladder-heading" className={compact ? "" : "card p-5 sm:p-6"} style={{ background: compact ? "transparent" : undefined }}>
      {!compact && (
        <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <div className="eyebrow">Coverage of pooled portfolio demand</div>
            <h2 id="ladder-heading" className="cond mt-1 text-2xl font-semibold">
              The same question, asked three ways
            </h2>
          </div>
          <p className="max-w-md text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
            Spend-weighted over <span className="mono">{fmtMoney(c.spend_total)}</span> a year across{" "}
            <span className="mono">{c.line_total}</span> pooled orders. Each rung asks more of the evidence than the one above it.
          </p>
        </div>
      )}

      <ol className="space-y-4">
        {rungs.map((r, i) => (
          <li key={r.key} className="rise" style={{ animationDelay: `${i * 110}ms` }}>
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex items-baseline gap-2">
                <span className="mono text-[0.6875rem]" style={{ color: "var(--faint)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-medium">{r.label}</span>
              </div>
              <div className="flex items-baseline gap-2 whitespace-nowrap">
                <span className="mono text-xl font-semibold sm:text-2xl" style={{ color: TONE[r.tone].text }}>
                  {fmtPct(r.share)}
                </span>
                <span className="mono text-[0.6875rem]" style={{ color: "var(--faint)" }}>
                  {fmtPct(r.lines)} of orders
                </span>
              </div>
            </div>

            {/* The bar. A hairline track holds the full width so the empty
                space reads as absence rather than as nothing being there. */}
            <div
              className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full"
              style={{ background: "var(--sunken)", boxShadow: "inset 0 0 0 1px var(--line)" }}
              role="img"
              aria-label={`${r.label}: ${fmtPct(r.share)} of spend`}
            >
              <div
                className="bar-fill absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${Math.max(r.share * 100, 0.35)}%`,
                  background: TONE[r.tone].bar,
                  animationDelay: `${140 + i * 110}ms`,
                }}
              />
            </div>

            {!compact && (
              <p className="mt-1.5 max-w-3xl text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                {r.gloss}
              </p>
            )}
          </li>
        ))}
      </ol>

      {!compact && (
        <p
          className="rise mt-5 border-t pt-4 text-sm leading-relaxed"
          style={{ borderColor: "var(--line)", animationDelay: "440ms" }}
        >
          <span style={{ color: "var(--accent)" }}>▲</span> A registry-style lookup says the Kingdom covers{" "}
          <span className="mono font-semibold">{fmtPct(c.coverage)}</span> of this spend. Checking the size, rating,
          material and standard actually demanded says it covers{" "}
          <span className="mono font-semibold" style={{ color: "var(--accent)" }}>
            {fmtPct(c.coverage_spec)}
          </span>
          . That gap is the thing nobody can see today — and it is what KAMIN exists to measure.
        </p>
      )}
    </section>
  );
}
