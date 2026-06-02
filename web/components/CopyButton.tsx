"use client";
import { useState } from "react";

export default function CopyButton({ text, label = "Copy", className = "btn-sm" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`btn ${className} ${done ? "btn-success" : ""}`}
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); }}
    >
      {done ? "✓ copied" : label}
    </button>
  );
}
