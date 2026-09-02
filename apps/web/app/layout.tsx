import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import { coverageSummary } from "@/lib/queries";
import { fmtMoney, fmtPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const c = await coverageSummary();
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b" style={{ borderColor: "var(--line)" }}>
          <div className="mx-auto flex max-w-7xl items-end justify-between gap-6 px-6 py-4">
            <div>
              <Link href="/" className="text-2xl font-semibold tracking-tight">KAMIN <span style={{ color: "var(--muted)" }}>كامن</span></Link>
              <nav className="mt-1 flex gap-4 text-sm" style={{ color: "var(--muted)" }}>
                <Link href="/">Gap ledger</Link>
                <Link href="/suppliers">Capabilities</Link>
              </nav>
            </div>
            <div className="text-right">
              <div className="mono text-4xl font-semibold" style={{ color: "var(--accent)" }}>{fmtPct(c.coverage_spec)}</div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>of {fmtMoney(c.spend_total)} a year in pooled portfolio demand has a supported local supplier at the stated specification.</div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>Product type verified, rating and size not yet: {fmtPct(c.coverage_type)} of spend. At category level, a verified supplier declaring the subheading: {fmtPct(c.coverage)} of spend, {fmtPct(c.line_coverage)} of orders.</div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-6 py-6 text-xs" style={{ color: "var(--muted)" }}>
          Demand is simulated on real Comtrade import values for Saudi Arabia, 2024, at a portfolio share of 12%. Supply is real: Tarmeez, MLCP, Made in Saudi and public evidence read by agents. Every claim carries its evidence and its auditor verdict.
        </footer>
      </body>
    </html>
  );
}
