import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Mail, ScrollText } from "lucide-react";
import { AmbientPage } from "../components/layout/AmbientPage";
import { PublicNavbar } from "../components/layout/PublicNavbar";
import { Footer } from "../components/layout/Footer";
import { LEGAL_DOCS, LEGAL_ENTITY, getLegalDoc } from "../legal";
import { cn } from "../lib/cn";

// One page for all four legal documents: /legal/:slug looks the document up in
// src/legal and renders it — title, "last updated", a plain-language "short
// version" box, a sticky table of contents, the numbered sections, and
// prev/next links. The documents themselves are plain JSX (<p>/<ul>/<strong>/
// <Link>) with no classes; the PROSE selectors below style them, so the
// content files stay readable and editable by a non-developer.

const PROSE = cn(
  "[&_p]:mt-4 [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-text-md",
  "[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2.5 [&_ul]:pl-5",
  "[&_li]:text-[15px] [&_li]:leading-relaxed [&_li]:text-text-md [&_li::marker]:text-accent-400",
  "[&_strong]:font-semibold [&_strong]:text-text-hi [&_em]:text-text-hi",
  "[&_a]:text-accent-300 [&_a]:underline [&_a]:decoration-accent-500/40 [&_a]:underline-offset-4 [&_a:hover]:text-accent-200"
);

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function LegalPage() {
  const { slug } = useParams();
  const doc = getLegalDoc(slug);

  useEffect(() => {
    if (!doc) return;
    const previous = document.title;
    document.title = `${doc.title} — Vantablock`;
    return () => {
      document.title = previous;
    };
  }, [doc]);

  // Unknown slug (or bare /legal) → the Terms, the document everything else
  // hangs off. A real 404 page isn't worth building for a four-document site.
  if (!doc) return <Navigate to="/legal/terms" replace />;

  const index = LEGAL_DOCS.indexOf(doc);
  const prev = LEGAL_DOCS[index - 1];
  const next = LEGAL_DOCS[index + 1];

  return (
    <AmbientPage>
      <PublicNavbar />
      <main>
        <section className="relative overflow-hidden border-b border-line-soft">
          <div className="pointer-events-none absolute inset-0 bg-grid fade-mask-b opacity-60" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[720px] -translate-x-1/2 rounded-full bg-accent-600/10 blur-[120px]" />
          <div className="relative mx-auto max-w-7xl px-6 pb-14 pt-16 lg:pt-20">
            <div className="max-w-2xl animate-fade-in-up">
              <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-400">Legal</p>
              <h1 className="mt-3 text-balance text-[2.25rem] font-bold leading-[1.1] tracking-tight text-text-hi sm:text-5xl">
                {doc.title}
              </h1>
              <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-text-md">{doc.description}</p>
              <p className="mt-5 text-[13px] text-text-lo">
                Last updated <time dateTime={doc.lastUpdated}>{formatDate(doc.lastUpdated)}</time> · Effective the same day
              </p>
            </div>
          </div>
        </section>

        <section className="relative py-14 lg:py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-12 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
              <aside className="lg:sticky lg:top-24 lg:self-start">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-text-lo">On this page</p>
                <ol className="mt-3 space-y-1.5 border-l border-line-soft">
                  {doc.sections.map((s, i) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="-ml-px block border-l border-transparent py-0.5 pl-4 text-[13px] leading-snug text-text-lo transition-colors hover:border-accent-500/60 hover:text-text-hi"
                      >
                        <span className="mr-1.5 font-mono text-[11px] text-text-lo/70">{i + 1}.</span>
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ol>

                <p className="mt-8 text-[12px] font-semibold uppercase tracking-wider text-text-lo">Other policies</p>
                <ul className="mt-3 space-y-1.5">
                  {LEGAL_DOCS.filter((d) => d.slug !== doc.slug).map((d) => (
                    <li key={d.slug}>
                      <Link
                        to={`/legal/${d.slug}`}
                        className="flex items-center gap-2 text-[13px] text-text-lo transition-colors hover:text-text-hi"
                      >
                        <ScrollText size={13} className="text-accent-400" />
                        {d.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </aside>

              <article className="min-w-0">
                <div className="rounded-2xl border border-accent-500/30 bg-accent-500/[0.06] p-6 sm:p-7">
                  <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-300">The short version</p>
                  <ul className={cn("mt-3 list-disc space-y-2 pl-5 text-[14.5px] leading-relaxed text-text-md", "[&_li::marker]:text-accent-400")}>
                    {doc.summary.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className="mt-4 text-[12.5px] text-text-lo">
                    This summary is here to help you read the document, not to replace it. If they ever differ, the full text below is what applies.
                  </p>
                </div>

                <div className={PROSE}>
                  {doc.sections.map((s, i) => (
                    <section
                      key={s.id}
                      id={s.id}
                      className={cn("scroll-mt-24 pt-10", i > 0 && "mt-10 border-t border-line-soft")}
                    >
                      <h2 className="text-xl font-semibold tracking-tight text-text-hi">
                        <span className="mr-2 font-mono text-[15px] text-accent-400">{i + 1}.</span>
                        {s.title}
                      </h2>
                      {s.body}
                    </section>
                  ))}
                </div>

                <div className="mt-14 flex flex-col gap-4 border-t border-line-soft pt-8 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2 text-[13px] text-text-lo">
                    <Mail size={14} className="text-accent-400" />
                    Questions about this document?{" "}
                    <a href={"mailto:" + LEGAL_ENTITY.legalEmail} className="text-accent-300 hover:text-accent-200">
                      {LEGAL_ENTITY.legalEmail}
                    </a>
                  </p>
                  <div className="flex items-center gap-2 text-[13px]">
                    {prev && (
                      <Link
                        to={`/legal/${prev.slug}`}
                        className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-text-md transition-colors hover:border-accent-500/40 hover:text-text-hi"
                      >
                        <ArrowLeft size={14} />
                        {prev.shortTitle}
                      </Link>
                    )}
                    {next && (
                      <Link
                        to={`/legal/${next.slug}`}
                        className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-text-md transition-colors hover:border-accent-500/40 hover:text-text-hi"
                      >
                        {next.shortTitle}
                        <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </AmbientPage>
  );
}
