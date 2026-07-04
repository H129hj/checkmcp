import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import ServerFaq from "../../../components/ServerFaq";
import { LEARN, learnBySlug } from "../../../lib/learn";

export const dynamicParams = false;

export function generateStaticParams() {
  return LEARN.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = learnBySlug(params.slug);
  if (!p) return { title: "Not found" };
  return {
    title: p.title,
    description: p.metaDescription,
    alternates: { canonical: `https://checkmcp.dev/learn/${p.slug}` },
    openGraph: { title: p.title, description: p.metaDescription, url: `https://checkmcp.dev/learn/${p.slug}`, type: "article" },
  };
}

export default function LearnArticle({ params }: { params: { slug: string } }) {
  const p = learnBySlug(params.slug);
  if (!p) notFound();
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: p.title,
    description: p.metaDescription,
    about: { "@type": "DefinedTerm", name: p.term },
    author: { "@type": "Organization", name: "CheckMCP", url: "https://checkmcp.dev" },
    publisher: { "@type": "Organization", name: "CheckMCP", url: "https://checkmcp.dev" },
    mainEntityOfPage: `https://checkmcp.dev/learn/${p.slug}`,
  };
  const related = p.related.map(learnBySlug).filter((r): r is NonNullable<typeof r> => Boolean(r));

  return (
    <article className="py-9">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <Link href="/learn" className="mb-4 inline-block font-mono text-xs text-base-content/50 hover:text-base-content">‹ learn</Link>
      <div className="max-w-2xl animate-rise">
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">MCP concepts</div>
        <h1 className="mt-3 text-[clamp(2rem,5vw,3.25rem)] font-extrabold leading-tight">{p.term}</h1>
        <p className="mt-4 text-lg leading-relaxed text-base-content/70">{p.answer}</p>

        {p.sections.map((s) => (
          <section key={s.heading} className="mt-8">
            <h2 className="mb-2 text-2xl font-extrabold">{s.heading}</h2>
            {s.body.map((para, i) => (
              <p key={i} className="mt-3 leading-relaxed text-base-content/60">{para}</p>
            ))}
          </section>
        ))}

        <section className="mt-8 card border border-primary/30 bg-primary/5">
          <div className="card-body p-6">
            <h2 className="font-mono text-xs uppercase tracking-widest text-primary">How CheckMCP handles it</h2>
            <p className="mt-1 leading-relaxed text-base-content/70">{p.checkmcpRelation}</p>
            <div className="mt-3"><Link href="/" className="btn btn-primary btn-sm">Audit an MCP server ›</Link></div>
          </div>
        </section>

        <ServerFaq items={p.faq} heading={`${p.term} — FAQ`} />

        {related.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-primary/80">Related</h2>
            <div className="flex flex-wrap gap-2">
              {related.map((r) => (
                <Link key={r.slug} href={`/learn/${r.slug}`} className="badge badge-outline badge-lg hover:border-primary hover:text-primary">{r.term}</Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
