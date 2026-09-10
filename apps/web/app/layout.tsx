import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic, IBM_Plex_Sans_Condensed, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

export const dynamic = "force-dynamic";

/* The stylesheet has always named IBM Plex; until now nothing loaded it, so
   every page silently fell back to system-ui. Self-hosting the four faces
   through next/font fixes that and removes the layout shift with it. Plex is
   the right family for this: an industrial typeface built for technical
   documents, with a real Arabic companion — which matters when supplier names
   and demand lines arrive in both scripts. */
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans", display: "swap" });
const plexCond = IBM_Plex_Sans_Condensed({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-plex-cond", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono", display: "swap" });
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600"], variable: "--font-plex-arabic", display: "swap" });

export const metadata: Metadata = {
  title: { default: "KAMIN · the supply map", template: "%s · KAMIN" },
  description: "What Saudi industry can supply, set against what the portfolio buys. Every claim carries its evidence.",
  robots: { index: false, follow: false },
};

/* Applies an explicit dark choice before first paint so the reader never sees
   a flash. Light needs no work: it is the default on every machine. */
const THEME_BOOT = `try{if(localStorage.getItem('kamin-theme')==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const fonts = `${plexSans.variable} ${plexCond.variable} ${plexMono.variable} ${plexArabic.variable}`;

  return (
    <html lang="en" className={fonts} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-screen antialiased">
        {/* The application shell: a fixed rail, then the working surface.
            The rail collapses below lg — this is an internal tool used on a
            laptop (the brief says desktop first at 1440), so the small-screen
            case degrades to the toolbar alone rather than growing a drawer. */}
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-6 sm:px-7">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
