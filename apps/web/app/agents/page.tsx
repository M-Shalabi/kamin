import Link from "next/link";
import { agentStats, recentRuns } from "@/lib/queries";
import { AGENTS, Agent, SectionHead, isAgentRole } from "@/components/ui";
import { fmtInt } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agents" };

/* Who did what.
 *
 * Five roles built the map, and this screen is the one place they are all set
 * side by side: what each one is for, how many times it has run, how long a run
 * takes, what it wrote, and a way into the actual trajectories. Every figure is
 * a count from `runs`, `run_steps` and the tables each role writes — nothing on
 * this page is narrated. */

const PRODUCES: Record<string, string> = {
  coordinator: "demand lines resolved to an HS anchor",
  detective: "evidence records written",
  specifier: "evidence records with stated specifications",
  auditor: "capabilities judged, supported or refuted",
  advisor: "investment cases written",
};

/* The four roles the deck presents. The Specifier is the Detective's second
   pass, so it is rendered inside the Detective card rather than as a fifth
   peer: same agent, same colour, a later stage of the same investigation. */
const ORDER = ["coordinator", "detective", "auditor", "advisor"];

function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="mono text-base font-semibold leading-none" style={tone ? { color: tone } : undefined}>{value}</span>
      <span className="text-[0.6875rem] leading-tight" style={{ color: "var(--muted)" }}>{label}</span>
    </div>
  );
}

export default async function Page() {
  const stats = await agentStats();
  const byRole = new Map(stats.map((s) => [s.role, s]));
  const roles = ORDER.filter((r) => byRole.has(r));
  const runsByRole = await Promise.all(roles.map((r) => recentRuns(r, 4)));
  const spec = byRole.get("specifier") ?? null;

  const totalRuns = stats.reduce((a, s) => a + s.runs, 0);
  const totalIn = stats.reduce((a, s) => a + (s.tokens_in ?? 0), 0);
  const totalOut = stats.reduce((a, s) => a + (s.tokens_out ?? 0), 0);

  return (
    <div className="space-y-7">
      <section>
        <SectionHead eyebrow="Who did what" title="Four agents built this map">
          <p className="mono text-xs" style={{ color: "var(--muted)" }}>
            {fmtInt(totalRuns)} runs · {fmtInt(totalIn)} tokens in · {fmtInt(totalOut)} out
          </p>
        </SectionHead>
        <p className="max-w-4xl text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          Nothing on the map was written by hand. Each role does one job against one input and leaves a full
          trajectory: every step, every token, every page it read. Any claim anywhere in the product links back
          to the run that produced it, so the answer to <em>&ldquo;how do you know that?&rdquo;</em> is always one
          click away.
        </p>
      </section>

      <div className="space-y-4">
        {roles.map((role, i) => {
          const s = byRole.get(role)!;
          const a = isAgentRole(role) ? AGENTS[role] : null;
          const runs = runsByRole[i] ?? [];
          const tint = a?.tint ?? "var(--muted)";
          return (
            <section key={role} className="rise card overflow-hidden" style={{ animationDelay: `${i * 70}ms` }}>
              {/* Header band, tinted to the role so the five read as a set. */}
              <div
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-5 py-3"
                style={{ background: `color-mix(in oklab, ${tint} 7%, transparent)`, borderColor: "var(--line)" }}
              >
                <div className="flex items-baseline gap-3">
                  <span className="cond text-xl font-semibold" style={{ color: tint }}>{a?.en ?? role}</span>
                  {a && <span className="ar text-base" dir="auto" style={{ color: "var(--muted)" }}>{a.ar}</span>}
                </div>
                <span className="mono text-[0.6875rem]" style={{ color: "var(--muted)" }}>
                  role = {role}
                </span>
              </div>

              <div className="px-5 py-4">
                <p className="max-w-3xl text-sm leading-relaxed">{a?.does}</p>

                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
                  <Stat value={fmtInt(s.produced)} label={PRODUCES[role] ?? "records written"} tone={tint} />
                  <Stat value={fmtInt(s.runs)} label="runs" />
                  <Stat value={fmtInt(s.ok)} label="completed" tone="var(--ok)" />
                  <Stat value={fmtInt(s.failed)} label="failed" tone={s.failed ? "var(--bad)" : undefined} />
                  <Stat value={s.avg_seconds ? `${Math.round(s.avg_seconds)}s` : "·"} label="average run" />
                </div>

                {role === "detective" && spec && (
                  <div className="mt-4 rounded-md border p-4" style={{ borderColor: "var(--line)", background: "var(--sunken)" }}>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="cond text-base font-semibold" style={{ color: tint }}>Second pass</span>
                      <span className="ar text-sm" dir="auto" style={{ color: "var(--muted)" }}>تمريرة ثانية</span>
                      <span className="mono text-[0.6875rem]" style={{ color: "var(--faint)" }}>role = specifier</span>
                    </div>
                    <p className="mt-1.5 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                      The first pass establishes <em>that</em> a supplier makes valves. The second establishes{" "}
                      <em>which</em> valves: it reads the catalogues and datasheets, following PDF links one level
                      below the product pages, and writes the sizes, ratings, materials and standards those
                      documents actually state. It is the only thing that moves an order from declared at
                      category level to verified at the stated specification.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
                      <Stat value={fmtInt(spec.produced)} label="evidence records with stated specs" tone={tint} />
                      <Stat value={fmtInt(spec.runs)} label="runs" />
                      <Stat value={fmtInt(spec.ok)} label="completed" tone="var(--ok)" />
                      <Stat value={fmtInt(spec.failed)} label="failed" tone={spec.failed ? "var(--bad)" : undefined} />
                      <Stat value={spec.avg_seconds ? `${Math.round(spec.avg_seconds)}s` : "·"} label="average run" />
                    </div>
                  </div>
                )}

                {runs.length > 0 && (
                  <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--line)" }}>
                    <div className="eyebrow mb-2">See it for yourself · recent trajectories</div>
                    <div className="flex flex-wrap gap-1.5">
                      {runs.map((r) => (
                        <Link
                          key={r.id}
                          href={`/runs/${r.id}`}
                          className="mono inline-flex items-center gap-2 rounded border px-2 py-1 text-[0.6875rem] transition-colors hover:bg-[var(--chip)]"
                          style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                          title={`${r.model} · ${r.started_at.slice(0, 19)}`}
                        >
                          <span
                            aria-hidden
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ background: r.status === "ok" ? "var(--ok)" : "var(--bad)" }}
                          />
                          <span className="max-w-[190px] truncate">{r.input_ref}</span>
                          {r.seconds != null && <span style={{ color: "var(--faint)" }}>{Math.round(r.seconds)}s</span>}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section className="card p-5">
        <div className="eyebrow">How to read attribution elsewhere</div>
        <h2 className="cond mt-1 text-lg font-semibold">This badge means an agent wrote it</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          Wherever a claim appears in the product it carries the role that produced it. Click the badge to open
          that run&rsquo;s trajectory.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ORDER.map((r) => <Agent key={r} role={r} withArabic />)}
        </div>
      </section>
    </div>
  );
}
