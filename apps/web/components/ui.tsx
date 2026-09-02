import Link from "next/link";
import type { ReactNode } from "react";
import { classLabel, fmtInt, fmtMoney, fmtPct } from "@/lib/format";

export const Money = ({ v }: { v: number | null | undefined }) => <span className="mono">{fmtMoney(v)}</span>;
export const Int = ({ v }: { v: number | null | undefined }) => <span className="mono">{fmtInt(v)}</span>;
export const Pct = ({ v }: { v: number | null | undefined }) => <span className="mono">{fmtPct(v)}</span>;

const TIER_LABEL: Record<number, string> = { 1: "Tier 1, third-party verified", 2: "Tier 2, official registry", 3: "Tier 3, self-published", 4: "Tier 4, inferred" };
export const Tier = ({ t }: { t: number | null | undefined }) => t ? <span title={TIER_LABEL[t]} className="mono rounded px-1.5 py-0.5 text-xs" style={{ background: t <= 2 ? "#dff1e3" : "#f3ead6", color: "#14110f" }}>T{t}</span> : <span className="text-xs" style={{ color: "var(--muted)" }}>no evidence</span>;

export const Verdict = ({ v }: { v: string }) => {
  const c = v === "supported" ? "#1f7a3a" : v === "refuted" ? "#b3261e" : "var(--muted)";
  return <span className="text-xs font-medium uppercase tracking-wide" style={{ color: c }}>{v}</span>;
};

export const ClassBadge = ({ c }: { c: string }) => <span className="rounded border px-1.5 py-0.5 text-xs" style={{ borderColor: "var(--line)" }}>{classLabel(c)}</span>;

export const GapKind = ({ k }: { k: string | null }) => {
  const label = k === "covered" ? "covered" : k === "manufacturing_gap" ? "manufacturing gap" : k === "supply_gap" ? "supply gap" : "unmatched";
  const color = k === "covered" ? "#1f7a3a" : k === "manufacturing_gap" ? "var(--accent)" : k === "supply_gap" ? "#b3261e" : "var(--muted)";
  return <span className="text-xs font-medium uppercase tracking-wide" style={{ color }}>{label}</span>;
};

export const Registry = ({ tarmeez, mlcp, mis, source }: { tarmeez: boolean; mlcp: boolean; mis: boolean; source: string }) => (
  <span className="flex flex-wrap gap-1 text-xs">
    {tarmeez && <span className="rounded px-1.5 py-0.5" style={{ background: "#ebe6dc" }}>Tarmeez</span>}
    {mlcp && <span className="rounded px-1.5 py-0.5" style={{ background: "#ebe6dc" }}>MLCP</span>}
    {mis && <span className="rounded px-1.5 py-0.5" style={{ background: "#dff1e3" }}>Made in Saudi</span>}
    {!tarmeez && <span className="rounded px-1.5 py-0.5" style={{ background: "#fde4d8", color: "var(--accent)" }}>{source === "hunt" ? "found by KAMIN" : "outside Tarmeez"}</span>}
  </span>
);

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded border" style={{ borderColor: "var(--line)" }}>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>{head.map((h, i) => <th key={i} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className = "" }: { children: ReactNode; className?: string }) => <td className={`border-t px-3 py-2 align-top ${className}`} style={{ borderColor: "var(--line)" }}>{children}</td>;
export const A = ({ href, children }: { href: string; children: ReactNode }) => <Link href={href} className="underline decoration-dotted underline-offset-2">{children}</Link>;
export const Ar = ({ s }: { s: string | null | undefined }) => (s ? <span dir="auto">{s}</span> : null);
