"use client";

import { useEffect, useState } from "react";

/**
 * Light / dark, and light is the default on every machine.
 *
 * The design brief fixes the product as a light surface — the deck is
 * near-black and the product deliberately is not, so screens read as real
 * software rather than as slides. So there is no prefers-color-scheme rule in
 * the stylesheet and no "system" setting here: a dark-set laptop still opens
 * the product light. Dark is reached only by choosing it.
 *
 * The icon shows the destination, not the current state — a moon means "go
 * dark". That is the convention people already read correctly, and the label
 * says it in words for anyone it does not.
 */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const Moon = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" {...stroke} aria-hidden>
    <path d="M13.4 9.8A5.6 5.6 0 0 1 6.2 2.6a5.8 5.8 0 1 0 7.2 7.2z" />
  </svg>
);

const Sun = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" {...stroke} aria-hidden>
    <circle cx="8" cy="8" r="3.1" />
    <path d="M8 1.4v1.5M8 13.1v1.5M14.6 8h-1.5M2.9 8H1.4M12.66 3.34l-1.06 1.06M4.4 11.6l-1.06 1.06M12.66 12.66 11.6 11.6M4.4 4.4 3.34 3.34" />
  </svg>
);

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      setDark(localStorage.getItem("kamin-theme") === "dark");
    } catch {
      /* private mode — stay light */
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    const root = document.documentElement;
    if (next) {
      root.setAttribute("data-theme", "dark");
      try { localStorage.setItem("kamin-theme", "dark"); } catch { /* private mode */ }
    } else {
      root.removeAttribute("data-theme");
      try { localStorage.removeItem("kamin-theme"); } catch { /* private mode */ }
    }
  };

  const label = dark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      aria-pressed={dark}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-md border transition-colors hover:bg-[var(--chip)]"
      style={{ borderColor: "var(--line)", color: "var(--muted)" }}
    >
      {dark ? <Sun /> : <Moon />}
    </button>
  );
}
