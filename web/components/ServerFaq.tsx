import type { FaqItem } from "../lib/faq";

// Visible per-server Q&A + FAQPage JSON-LD (single-sourced). Pure server component.
export default function ServerFaq({ items, heading = "Frequently asked" }: { items: FaqItem[]; heading?: string }) {
  if (!items.length) return null;
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return (
    <section className="mt-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-primary/80">{heading}</h2>
      <div className="space-y-2">
        {items.map((f) => (
          <details key={f.q} className="group card border border-base-content/10 bg-base-200/60">
            <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 text-sm font-bold">
              <span>{f.q}</span>
              <span className="font-mono text-primary transition group-open:rotate-45">+</span>
            </summary>
            <div className="px-4 pb-4 text-sm leading-relaxed text-base-content/60">{f.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
