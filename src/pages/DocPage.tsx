import { Link, useParams } from "react-router-dom";
import { PageMeta } from "@/components/seo/PageMeta";
import { JsonLd } from "@/components/seo/JsonLd";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { DocsContent } from "@/components/docs/DocsContent";
import { docDescription, docEntries, getDocEntry } from "@/data/docsContent";
import NotFound from "./NotFound";

export default function DocPage() {
  const { slug = "" } = useParams();
  const entry = getDocEntry(slug);
  if (!entry) return <NotFound />;

  const index = docEntries.indexOf(entry);
  const prev = docEntries[index - 1];
  const next = docEntries[index + 1];
  const url = `https://openeye.sh/docs/${entry.id}`;
  const description = docDescription(entry);

  return (
    <DocsLayout activeId={entry.id} showHeader={false}>
      <PageMeta
        title={`${entry.title} | OpenEye Docs`}
        description={description}
        path={`/docs/${entry.id}`}
        type="article"
      />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "TechArticle",
            headline: entry.title,
            description,
            url,
            articleSection: entry.group,
            isPartOf: { "@type": "WebSite", name: "OpenEye", url: "https://openeye.sh" },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Docs", item: "https://openeye.sh/docs" },
              { "@type": "ListItem", position: 2, name: entry.group },
              { "@type": "ListItem", position: 3, name: entry.title, item: url },
            ],
          },
        ]}
      />
      <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
        <Link to="/docs" className="hover:text-foreground transition-colors">Docs</Link>
        <span className="mx-2">/</span>
        <span>{entry.group}</span>
      </nav>
      <DocsContent section={entry} />
      <div className="mt-16 pt-6 border-t border-foreground/[0.06] flex justify-between gap-4 text-sm">
        {prev ? (
          <Link to={`/docs/${prev.id}`} className="text-muted-foreground hover:text-foreground transition-colors">
            ← {prev.title}
          </Link>
        ) : <span />}
        {next && (
          <Link to={`/docs/${next.id}`} className="text-muted-foreground hover:text-foreground transition-colors text-right">
            {next.title} →
          </Link>
        )}
      </div>
    </DocsLayout>
  );
}
