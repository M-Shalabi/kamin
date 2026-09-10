"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * The rail. Four destinations, matching the reference: pooled orders, the gap
 * ledger, suppliers, coverage.
 *
 * Orders and gaps are the same route under different filters, so "active" has
 * to read the query string as well as the path — otherwise both light up at
 * once. Coverage and suppliers are ordinary routes.
 *
 * The active item takes the accent tint (accbg) with accent text and an accent
 * icon, exactly as the reference does. It is the only place in the chrome that
 * spends colour.
 */

type Item = { href: string; label: string; arabic: string; match: (p: string, k: string | null) => boolean; icon: React.ReactNode };

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const ITEMS: Item[] = [
  {
    href: "/suppliers",
    label: "Suppliers",
    arabic: "الموردون",
    match: (p) => p === "/" || p.startsWith("/suppliers"),
    icon: (
      <svg viewBox="0 0 16 16" width="15" height="15" {...stroke}>
        <path d="M2 13.5V6.2l6-3.7 6 3.7v7.3" />
        <path d="M6.2 13.5V9h3.6v4.5" />
      </svg>
    ),
  },
  {
    href: "/orders?kind=all",
    label: "Pooled orders",
    arabic: "الطلبات",
    match: (p, k) => p.startsWith("/orders") && k === "all",
    icon: (
      <svg viewBox="0 0 16 16" width="15" height="15" {...stroke}>
        <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h7" />
      </svg>
    ),
  },
  {
    href: "/orders?kind=manufacturing_gap",
    label: "Gap ledger",
    arabic: "الفجوات",
    match: (p, k) => p.startsWith("/orders") && k !== "all",
    icon: (
      <svg viewBox="0 0 16 16" width="15" height="15" {...stroke}>
        <path d="M8 2.2 14.4 13.4H1.6z" />
        <path d="M8 6.6v3.1M8 11.6h.01" />
      </svg>
    ),
  },
  {
    href: "/graph",
    label: "Relations",
    arabic: "العلاقات",
    match: (p) => p.startsWith("/graph"),
    icon: (
      <svg viewBox="0 0 16 16" width="15" height="15" {...stroke}>
        <circle cx="3.6" cy="4.2" r="1.7" />
        <circle cx="12.4" cy="3.4" r="1.7" />
        <circle cx="8" cy="12.4" r="1.7" />
        <path d="M4.9 5.4 7.1 11M11.4 4.9 8.9 11M5.3 4 10.7 3.6" />
      </svg>
    ),
  },
  {
    href: "/agents",
    label: "Agents",
    arabic: "الوكلاء",
    match: (p) => p.startsWith("/agents"),
    icon: (
      <svg viewBox="0 0 16 16" width="15" height="15" {...stroke}>
        <circle cx="8" cy="5.4" r="2.4" />
        <path d="M3.4 13.2c0-2.3 2.1-3.8 4.6-3.8s4.6 1.5 4.6 3.8" />
      </svg>
    ),
  },
  {
    href: "/coverage",
    label: "Coverage",
    arabic: "التغطية",
    match: (p) => p.startsWith("/coverage"),
    icon: (
      <svg viewBox="0 0 16 16" width="15" height="15" {...stroke}>
        <path d="M2 12.6 6 8l3 2.6 5-6.4" />
        <path d="M2 14h12" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname() || "/";
  const kind = useSearchParams()?.get("kind") ?? null;

  return (
    <aside
      className="sticky top-0 hidden h-screen w-[228px] shrink-0 flex-col border-r lg:flex"
      style={{ background: "var(--sunken)", borderColor: "var(--line)" }}
    >
      <Link href="/suppliers" className="group flex items-center gap-2.5 px-5 py-5">
        <Image src="/kamin-mark.png" alt="" width={30} height={30} priority className="rounded-[22%]" style={{ width: 30, height: 30 }} />
        <span className="flex items-baseline gap-1.5 leading-none">
          <span className="cond text-lg font-semibold tracking-[-0.02em]">KAMIN</span>
          <span className="ar text-sm" style={{ color: "var(--muted)" }} dir="auto">كامن</span>
        </span>
      </Link>

      <nav className="flex flex-col gap-0.5 px-3">
        {ITEMS.map((it) => {
          const on = it.match(pathname, kind);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={on ? "page" : undefined}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-sm transition-colors"
              style={on
                ? { background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 500 }
                : { color: "var(--ink-soft)" }}
            >
              <span style={{ color: on ? "var(--accent)" : "var(--faint)" }}>{it.icon}</span>
              <span>{it.label}</span>
              <span className="ar mr-0 ms-auto text-xs" style={{ color: on ? "var(--accent)" : "var(--faint)" }} dir="auto">
                {it.arabic}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
