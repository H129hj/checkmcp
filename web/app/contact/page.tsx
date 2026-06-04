export const metadata = {
  title: "Contact — CheckMCP",
  description: "Get in touch with the CheckMCP team — support, security reports, partnerships.",
  alternates: { canonical: "/contact" },
};

export default function Contact() {
  return (
    <div className="max-w-2xl py-16">
      <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">Contact</div>
      <h1 className="mt-3 text-3xl font-extrabold">Get in touch</h1>
      <p className="mt-3 text-base-content/60">
        Questions, support, security reports or partnerships — we read everything.
      </p>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <a href="mailto:contact@checkmcp.dev" className="card border border-base-content/10 bg-base-200/60 transition hover:border-primary/40">
          <div className="card-body p-5">
            <div className="font-mono text-xs uppercase tracking-widest text-base-content/40">Email</div>
            <div className="font-semibold text-primary">contact@checkmcp.dev</div>
            <p className="text-sm text-base-content/50">General, support &amp; partnerships.</p>
          </div>
        </a>
        <a href="https://github.com/H129hj/checkmcp" rel="noopener" className="card border border-base-content/10 bg-base-200/60 transition hover:border-primary/40">
          <div className="card-body p-5">
            <div className="font-mono text-xs uppercase tracking-widest text-base-content/40">GitHub</div>
            <div className="font-semibold text-primary">H129hj/checkmcp</div>
            <p className="text-sm text-base-content/50">Issues, the open-source CLI &amp; gateway.</p>
          </div>
        </a>
      </div>
      <p className="mt-6 text-sm text-base-content/40">
        Security disclosure: email <span className="text-base-content/60">contact@checkmcp.dev</span> with “security” in the subject.
      </p>
    </div>
  );
}
