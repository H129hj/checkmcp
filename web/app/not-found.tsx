import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="max-w-xl py-28">
      <div className="font-mono text-6xl font-extrabold text-primary">404</div>
      <h1 className="mb-2 mt-4 text-3xl font-extrabold">Page not found</h1>
      <p className="mb-6 text-lg text-base-content/60">This page doesn&apos;t exist. Were you trying to audit an MCP server?</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="btn btn-primary">Audit a URL</Link>
        <Link href="/directory" className="btn btn-ghost">Browse the directory</Link>
      </div>
    </div>
  );
}
