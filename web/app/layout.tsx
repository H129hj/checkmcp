import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getUser } from "../lib/auth";
import { hreflang } from "../lib/i18n";
import ThemeToggle from "../components/ThemeToggle";

export const viewport: Viewport = { themeColor: "#0a0a0c", colorScheme: "light dark" };

export const metadata: Metadata = {
  metadataBase: new URL("https://checkmcp.dev"),
  title: { default: "CheckMCP — quality, security & context-cost score for MCP servers", template: "%s | CheckMCP" },
  description:
    "Vendor-neutral audit of MCP servers: one explainable MCP Score /100 (security, tool design, schemas, context-cost, compliance, reliability) with causal attribution and actionable fixes.",
  alternates: { canonical: "/", languages: hreflang("/") },
  openGraph: { title: "CheckMCP", description: "The quality standard for MCP servers — one explainable /100 score.", url: "https://checkmcp.dev", siteName: "CheckMCP", type: "website" },
  twitter: { card: "summary_large_image", title: "CheckMCP", description: "The quality standard for MCP servers." },
};

const NAV = [
  { href: "/directory", label: "Directory" },
  { href: "/dashboard", label: "Monitoring" },
  { href: "/badge", label: "Badge" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#methodology", label: "Methodology" },
];

const NO_FLASH = `(function(){try{var t=localStorage.getItem('theme');if(t!=='checkmcp'&&t!=='checkmcp-light'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'checkmcp-light':'checkmcp';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='checkmcp';}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser().catch(() => null);
  return (
    <html lang="en" data-theme="checkmcp">
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-base-100 text-base-content antialiased">
        <div className="grain" aria-hidden />

        <header className="sticky top-0 z-50 border-b border-base-content/10 bg-base-100/70 backdrop-blur-xl">
          <div className="navbar mx-auto max-w-6xl px-4">
            <div className="flex-1">
              <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px_#ccff00] animate-pulseDot" />
                CheckMCP
              </Link>
            </div>
            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="btn btn-ghost btn-sm font-normal text-base-content/70 hover:text-base-content">{n.label}</Link>
              ))}
              <ThemeToggle />
              {user
                ? <Link href="/account" className="btn btn-primary btn-sm ml-1">My space</Link>
                : <Link href="/login" className="btn btn-primary btn-sm ml-1">Sign in</Link>}
            </nav>
            <div className="flex items-center gap-1 md:hidden">
              <ThemeToggle />
              <div className="dropdown dropdown-end">
                <div tabIndex={0} role="button" className="btn btn-ghost btn-sm btn-square" aria-label="Menu">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                </div>
                <ul tabIndex={0} className="menu dropdown-content z-[60] mt-3 w-52 rounded-box border border-base-content/10 bg-base-200 p-2 shadow-xl">
                  {NAV.map((n) => <li key={n.href}><Link href={n.href}>{n.label}</Link></li>)}
                  <li><Link href={user ? "/account" : "/login"} className="text-primary">{user ? "My space" : "Sign in"}</Link></li>
                </ul>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4">{children}</main>

        <footer className="mt-20 border-t border-base-content/10">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 font-mono text-xs text-base-content/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>checkmcp.dev — vendor-neutral MCP server audits</span>
              <span className="text-base-content/35">spec 2025-11-25 · OWASP MCP Top 10 · open methodology</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-base-content/10 pt-3 text-base-content/40">
              <span>© {new Date().getFullYear()} CheckMCP</span>
              <Link href="/pricing" className="hover:text-base-content">Pricing</Link>
              <Link href="/directory" className="hover:text-base-content">Directory</Link>
              <Link href="/terms" className="hover:text-base-content">Terms</Link>
              <Link href="/privacy" className="hover:text-base-content">Privacy</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
