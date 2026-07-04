import Link from "next/link";

export const metadata = {
  title: "Download — CheckMCP desktop apps",
  description:
    "Clearance (pre-flight MCP & site auditor) and Fleet (live Claude Code monitor) — native macOS menu-bar apps. Free, fast, built in Rust.",
  alternates: { canonical: "/download" },
};

// Revalidate hourly so a fresh release shows up without a redeploy.
export const revalidate = 3600;

const REPO = "H129hj/checkmcp-desktop";
const RELEASES = `https://github.com/${REPO}/releases`;

type Asset = { name: string; browser_download_url: string; size: number };
type Release = { tag_name: string; assets: Asset[]; html_url: string };

async function latestRelease(): Promise<Release | null> {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    if (!r.ok) return null;
    return (await r.json()) as Release;
  } catch {
    return null;
  }
}

function pickDmg(rel: Release | null, app: string): Asset | null {
  if (!rel) return null;
  const re = new RegExp(`^${app}.*\\.dmg$`, "i");
  return rel.assets.find((a) => re.test(a.name)) || null;
}

const fmtMB = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

const APPS = [
  {
    id: "Clearance",
    tag: "Pre-flight auditor",
    accent: "#c6f24e",
    desc: "Paste a URL — Clearance scans every page locally, in Rust, in milliseconds. ~115 launch checks across Money, Trust, Works, Visibility & Security. Your pre-ship clearance.",
    features: ["~115 pre-launch checks", "Whole-site crawl, 12-way concurrent", "Export Markdown / JSON reports", "100% local — nothing leaves your Mac"],
    logo: (
      <svg viewBox="0 0 22 22" className="h-12 w-12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="22" height="22" rx="7" fill="#c6f24e" />
        <polygon points="11,4.5 13.5,16.5 8.5,16.5" fill="rgba(0,0,0,0.18)" />
        <path d="M11 4.5 C10.2 4.5 9.8 5.2 9.8 6.2 L9.8 14.8 L12.2 14.8 L12.2 6.2 C12.2 5.2 11.8 4.5 11 4.5Z" fill="#0d140a" />
        <path d="M3.5 9.8 L9.8 8.8 L12.2 8.8 L18.5 9.8 L17.5 11.4 L12.2 10.4 L9.8 10.4 L4.5 11.4Z" fill="#0d140a" />
        <path d="M7.2 13.5 L9.8 12.8 L9.8 14.8 L7.2 15.2Z" fill="#0d140a" />
        <path d="M14.8 13.5 L12.2 12.8 L12.2 14.8 L14.8 15.2Z" fill="#0d140a" />
      </svg>
    ),
  },
  {
    id: "Fleet",
    tag: "Live Claude Code monitor",
    accent: "#a78bfa",
    desc: "Fleet watches ~/.claude live and shows every Claude Code session at a glance — who needs you, who's building, token burn, tasks left. Native notifications the moment a session needs a reply.",
    features: ["Live session states from ~/.claude", "Needs-you alerts + tray badge", "Per-session focus view & burn", "Launch at login, ~35 MB idle"],
    logo: (
      <svg viewBox="0 0 22 22" className="h-12 w-12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="22" height="22" rx="7" fill="#7c3aed" />
        <line x1="11" y1="5.5" x2="4.5" y2="16" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round" />
        <line x1="11" y1="5.5" x2="17.5" y2="16" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round" />
        <line x1="4.5" y1="16" x2="17.5" y2="16" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeLinecap="round" />
        <circle cx="11" cy="5.5" r="2.4" fill="#fff" />
        <circle cx="4.5" cy="16" r="1.8" fill="#fff" />
        <circle cx="17.5" cy="16" r="1.8" fill="#fff" />
      </svg>
    ),
  },
];

export default async function Download() {
  const rel = await latestRelease();
  const version = rel?.tag_name?.replace(/^v/, "") || null;

  return (
    <div className="py-12">
      <div className="text-center">
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">Desktop apps</div>
        <h1 className="mt-2 text-4xl font-extrabold">CheckMCP on your menu bar.</h1>
        <p className="mx-auto mt-3 max-w-2xl text-base-content/60">
          Two native macOS apps, built in Rust. <b className="text-base-content/80">Clearance</b> audits before you ship;{" "}
          <b className="text-base-content/80">Fleet</b> watches your Claude Code sessions live. Free.
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {APPS.map((app) => {
          const dmg = pickDmg(rel, app.id);
          return (
            <div
              key={app.id}
              className="card border border-base-content/10 bg-base-200/60"
              style={{ boxShadow: `0 0 0 1px ${app.accent}22` }}
            >
              <div className="card-body gap-4">
                <div className="flex items-center gap-3">
                  {app.logo}
                  <div>
                    <h2 className="text-xl font-extrabold leading-tight">{app.id}</h2>
                    <div className="font-mono text-xs" style={{ color: app.accent }}>{app.tag}</div>
                  </div>
                </div>
                <p className="text-sm text-base-content/70">{app.desc}</p>
                <ul className="mt-1 space-y-2 text-sm">
                  {app.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span style={{ color: app.accent }}>✓</span>
                      <span className="text-base-content/80">{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2">
                  {dmg ? (
                    <a
                      href={dmg.browser_download_url}
                      className="btn btn-block btn-sm"
                      style={{ background: app.accent, color: "#0c1106", border: 0 }}
                    >
                      Download {app.id} {version && `v${version}`}
                      <span className="font-mono text-xs opacity-60">· {fmtMB(dmg.size)}</span>
                    </a>
                  ) : (
                    <a href={RELEASES} className="btn btn-block btn-sm btn-outline" rel="noopener">
                      Releases →
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mx-auto mt-8 max-w-2xl text-center text-xs text-base-content/40">
        <p>
          macOS 12+ · Apple Silicon · ~6 MB each. Apps auto-update in place. First launch:{" "}
          {rel ? "double-click to open" : "right-click → Open (until notarized)"}.
        </p>
        <p className="mt-2">
          Older versions and release notes on{" "}
          <a href={RELEASES} className="text-primary hover:underline" rel="noopener">GitHub Releases</a>. Prefer the
          terminal? The <Link href="/pricing" className="text-primary hover:underline">open-source CLI</Link> audits from CI.
        </p>
      </div>
    </div>
  );
}
