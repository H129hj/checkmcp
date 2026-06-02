"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"checkmcp" | "checkmcp-light">("checkmcp");
  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as any) === "checkmcp-light" ? "checkmcp-light" : "checkmcp");
  }, []);
  function toggle() {
    const next = theme === "checkmcp" ? "checkmcp-light" : "checkmcp";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
  }
  const dark = theme === "checkmcp";
  return (
    <button onClick={toggle} className="btn btn-ghost btn-sm btn-square" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title="Toggle theme">
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      )}
    </button>
  );
}
