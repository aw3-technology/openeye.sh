import { Link, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageMeta } from "@/components/seo/PageMeta";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getCatalogModel,
  getRegistryModel,
  registryModels,
  taskLabels,
} from "@/data/modelRegistry";
import NotFound from "./NotFound";

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-card rounded-outer border p-4 overflow-x-auto font-mono text-sm leading-relaxed text-oe-green">
      <code>{children}</code>
    </pre>
  );
}

export default function ModelPage() {
  const { slug = "" } = useParams();
  const model = getRegistryModel(slug);
  if (!model) return <NotFound />;

  const catalog = getCatalogModel(model.name);
  const url = `https://openeye.sh/models/${model.slug}`;
  const title = `Run ${model.name} Locally from the CLI | OpenEye`;
  const description = `Run ${model.name} (${model.keyword}) on your own machine with one command: openeye pull ${model.slug}. Open-source CLI, REST and WebSocket API, CPU or GPU.`;
  const hardware = [
    model.hardware.cpu && "CPU",
    model.hardware.cuda && "NVIDIA CUDA",
    model.hardware.mps && "Apple Silicon (MPS)",
  ].filter(Boolean).join(", ");
  const related = registryModels.filter((m) => m.task === model.task && m.slug !== model.slug);
  const others = related.length > 0 ? related : registryModels.filter((m) => m.slug !== model.slug).slice(0, 3);

  const specs: [string, string][] = [
    ["Task", taskLabels[model.task]],
    ["CLI id", model.slug],
    ...(catalog ? [["Creator", catalog.creator] as [string, string]] : []),
    ["Weights", `${model.hfRepo} (~${model.sizeMb} MB)`],
    ["Hardware", hardware],
    ["Install extra", `openeye-sh[${model.extra}]`],
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageMeta title={title} description={description} path={`/models/${model.slug}`} type="article" />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "TechArticle",
            headline: `Run ${model.name} locally with OpenEye`,
            description,
            url,
            about: { "@type": "SoftwareApplication", name: model.name },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Models", item: "https://openeye.sh/models" },
              { "@type": "ListItem", position: 2, name: model.name, item: url },
            ],
          },
        ]}
      />
      <Navbar />
      <main>
        <article className="pt-28 pb-24 px-4">
          <div className="container max-w-3xl mx-auto">
            <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-6">
              <Link to="/models" className="hover:text-foreground transition-colors">Models</Link>
              <span className="mx-2">/</span>
              <span>{taskLabels[model.task]}</span>
            </nav>

            <h1 className="text-3xl md:text-5xl font-semibold font-display mb-6">
              Run {model.name} locally with OpenEye
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-4">
              {model.name} is a {taskLabels[model.task].toLowerCase()} model: {model.summary.charAt(0).toLowerCase() + model.summary.slice(1)}{" "}
              OpenEye, the open-source perception CLI, downloads it, runs it on your CPU or GPU, and
              returns structured JSON you can pipe into scripts, agents, and robots.
            </p>
            {catalog && (
              <p className="text-muted-foreground leading-relaxed mb-10">{catalog.description}</p>
            )}

            <div className="overflow-x-auto rounded-outer border border-foreground/[0.06] mb-12">
              <table className="w-full text-sm">
                <tbody>
                  {specs.map(([label, value]) => (
                    <tr key={label} className="border-b border-foreground/[0.04] last:border-0">
                      <th scope="row" className="text-left px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-muted-foreground font-medium w-40">
                        {label}
                      </th>
                      <td className="px-4 py-2.5 font-mono">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="text-2xl font-semibold font-display mb-4">1. Install</h2>
            <Code>{`pipx install "openeye-sh[${model.extra}]"`}</Code>

            <h2 className="text-2xl font-semibold font-display mt-10 mb-4">2. Pull {model.name}</h2>
            <Code>{`openeye pull ${model.slug}`}</Code>

            <h2 className="text-2xl font-semibold font-display mt-10 mb-4">3. Run inference</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Output is JSON on stdout, so it composes with <code className="font-mono text-sm">jq</code> and
              any other Unix tool.
            </p>
            <Code>{model.runExample}</Code>

            <h2 className="text-2xl font-semibold font-display mt-10 mb-4">4. Serve it as an API</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Start a local server with REST and WebSocket endpoints for apps, agents, and live
              camera streams.
            </p>
            <Code>{`openeye serve ${model.slug}`}</Code>
            <p className="text-muted-foreground leading-relaxed mt-4">
              See the <Link to="/docs/cli-serve" className="text-terminal-green hover:underline">serve reference</Link>,{" "}
              <Link to="/docs/rest-endpoints" className="text-terminal-green hover:underline">REST endpoints</Link>, and{" "}
              <Link to="/docs/sdk-python" className="text-terminal-green hover:underline">Python SDK</Link>.
            </p>

            <h2 className="text-2xl font-semibold font-display mt-16 mb-4">Other models</h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {others.map((m) => (
                <li key={m.slug}>
                  <Link
                    to={`/models/${m.slug}`}
                    className="block border border-foreground/[0.06] rounded-outer p-4 bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors"
                  >
                    <div className="font-medium">{m.name}</div>
                    <div className="text-sm text-muted-foreground">{m.summary}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
