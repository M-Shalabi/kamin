import { coverageSummary, stats } from "@/lib/queries";
import { Ladder } from "@/components/Ladder";
import { SectionHead } from "@/components/ui";
import { fmtInt, fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Coverage" };

function Figure({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="mono text-lg font-semibold leading-none" style={tone ? { color: tone } : undefined}>{value}</span>
      <span className="text-[0.6875rem] leading-tight" style={{ color: "var(--muted)" }}>{label}</span>
    </div>
  );
}

export default async function Page() {
  const [c, s] = await Promise.all([coverageSummary(), stats()]);

  return (
    <div className="space-y-7">
      <Ladder c={c} />

      <section className="rise" style={{ animationDelay: "160ms" }}>
        <SectionHead eyebrow="Line coverage" title="The operational figure, subordinate to the headline">
          <p className="text-xs" style={{ color: "var(--muted)" }}>share of pooled orders, not of spend</p>
        </SectionHead>
        <div className="card grid grid-cols-2 gap-x-6 gap-y-4 p-4 sm:grid-cols-3">
          <Figure value={`${(c.line_coverage * 100).toFixed(1)}%`} label="orders at category level" />
          <Figure value={`${(c.line_coverage_type * 100).toFixed(1)}%`} label="orders type-verified" />
          <Figure value={`${(c.line_coverage_spec * 100).toFixed(1)}%`} label="orders at stated spec" tone="var(--accent)" />
        </div>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          Coverage is spend-weighted and portfolio-level. Line coverage counts orders instead of riyals, which
          treats a $23M order and a $40k one as equal — useful operationally, misleading as a headline.
        </p>
      </section>

      <section className="rise" style={{ animationDelay: "220ms" }}>
        <SectionHead eyebrow="Discovery lift" title="What KAMIN surfaced that no registry holds" />
        <div className="card grid grid-cols-2 gap-x-6 gap-y-4 p-4 sm:grid-cols-4">
          <Figure value={fmtInt(s.discovered)} label="suppliers outside Tarmeez" tone="var(--accent)" />
          <Figure value={fmtInt(s.investigated)} label="investigated by a Detective" />
          <Figure value={fmtInt(s.supported)} label="supported capabilities" tone="var(--ok)" />
          <Figure value={fmtInt(s.refuted)} label="refuted by the Auditor" tone="var(--bad)" />
        </div>
      </section>

      <section className="rise card p-5" style={{ animationDelay: "280ms", borderColor: "var(--line-strong)" }}>
        <div className="eyebrow">Not yet measured</div>
        <h2 className="cond mt-1 text-lg font-semibold">Incumbent coverage against full-map coverage</h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          The design brief calls the delta between these two — the same figure computed only over suppliers the
          portfolio already knew, set against the figure over the whole map — the sourcing opportunity, and
          &ldquo;the single most important number in the product.&rdquo; The incumbent baseline landed in the
          codebase but nothing computes the delta yet, so it is not shown. An empty panel is the honest state;
          a plausible number would not be.
        </p>
        <p className="mt-2 text-xs" style={{ color: "var(--faint)" }}>
          Pooled demand in scope: <span className="mono">{fmtMoney(c.spend_total)}</span> a year.
        </p>
      </section>
    </div>
  );
}
