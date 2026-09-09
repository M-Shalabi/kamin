import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * The application toolbar: search, and the theme control.
 *
 * Search posts to the suppliers list, which already matches on Arabic name,
 * English name and exact CR number — so a commercial registration pasted
 * straight in resolves to one company.
 *
 * The coverage figures used to ride here on every screen. They now live where
 * they belong: the ladder on /coverage, which can give all three the room to
 * explain how they differ. A toolbar that repeats a headline on screens the
 * headline is not about only teaches people to stop reading it.
 */
export function TopBar() {
  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between gap-x-6 border-b px-5 py-2.5 backdrop-blur sm:px-6"
      style={{ borderColor: "var(--line)", background: "color-mix(in oklab, var(--paper) 90%, transparent)" }}
    >
      <form action="/suppliers" className="relative min-w-0 flex-1 sm:max-w-md">
        <span aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--faint)" }}>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="7.2" cy="7.2" r="4.4" />
            <path d="m10.6 10.6 2.6 2.6" />
          </svg>
        </span>
        <input
          name="q"
          type="search"
          placeholder="Search a supplier or a CR number…"
          aria-label="Search suppliers by name or commercial registration number"
          className="w-full rounded-md border py-1.5 pl-8 pr-3 text-sm transition-colors"
          style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
        />
      </form>

      <ThemeToggle />
    </header>
  );
}
