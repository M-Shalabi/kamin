import Image from "next/image";

/**
 * The KAMIN lockup: the mark, then the wordmark.
 *
 * The mark is the product logo — a faceted black gem on the orange ground,
 * from assets/KAMIN.png. It is the name made literal: كامن is
 * "latent, hidden", and the deck opens on "What exists but has never been
 * found". A gem nobody has dug up yet.
 *
 * Served from a 128px raster rather than assets/KAMIN.svg because that SVG is a
 * VTracer auto-trace — 187KB across several hundred near-identical orange
 * paths, which is both heavier and blurrier at 36px than the bitmap it came
 * from. The full-resolution original stays in the repo as the source of truth.
 *
 * The wordmark stays in Plex Condensed. The deck sets it in Archivo, but the
 * application's typeface is Plex, and a lockup that switches families to shout
 * its own name reads as a foreign object pasted onto the page.
 */

export function Logo({ withArabic = true, size = 34 }: { withArabic?: boolean; size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <Image
        src="/kamin-mark.png"
        alt=""
        width={size}
        height={size}
        priority
        className="rounded-[22%] transition-transform duration-300 group-hover:scale-105"
        style={{ width: size, height: size }}
      />
      <span className="flex items-baseline gap-2 leading-none">
        <span className="cond text-[1.35rem] font-semibold tracking-[-0.02em]">KAMIN</span>
        {withArabic && (
          <span className="ar text-base" style={{ color: "var(--muted)" }} dir="auto">
            كامن
          </span>
        )}
      </span>
    </span>
  );
}
