import { Link, Navigate, useLocation } from "react-router-dom";
import { PageMeta } from "@/components/seo/PageMeta";
import { JsonLd } from "@/components/seo/JsonLd";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { docsContent, docDescription, getDocEntry } from "@/data/docsContent";

export default function Docs() {
  const location = useLocation();

  // Old single-page docs linked sections as /docs#<id>; send those to /docs/<id>.
  const legacyId = location.hash.slice(1);
  if (legacyId && getDocEntry(legacyId)) {
    return <Navigate to={`/docs/${legacyId}`} replace />;
  }

  return (
    <DocsLayout>
      <PageMeta
        title="Docs | OpenEye"
        description="OpenEye documentation: installation, CLI reference, model catalog, scene-graph API, and self-hosted deployment guides."
        path="/docs"
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "OpenEye Documentation",
          url: "https://openeye.sh/docs",
          hasPart: docsContent.flatMap((g) =>
            g.sections.map((s) => ({
              "@type": "TechArticle",
              headline: s.title,
              url: `https://openeye.sh/docs/${s.id}`,
            })),
          ),
        }}
      />
      <h1 className="text-3xl md:text-4xl font-light font-display mb-4">
        Documentation
      </h1>
      <p className="text-muted-foreground leading-relaxed mb-12 max-w-2xl">
        OpenEye is an open-source, CLI-first perception engine: install it with{" "}
        <code className="font-mono text-sm text-oe-green">pipx install openeye-sh</code>, pull a
        vision model, and get structured JSON from images, video, and live cameras.
      </p>
      <div className="space-y-12">
        {docsContent.map((group) => (
          <section key={group.label}>
            <h2 className="font-mono text-xs text-muted-foreground mb-4">
              {group.label}
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {group.sections.map((section) => (
                <Link
                  key={section.id}
                  to={`/docs/${section.id}`}
                  className="block border border-foreground/[0.06] rounded-outer p-4 bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors"
                >
                  <div className="font-medium mb-1">{section.title}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {docDescription(section)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </DocsLayout>
  );
}
