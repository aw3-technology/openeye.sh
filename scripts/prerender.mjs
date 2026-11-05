// Build-time prerender: turns the client-only Vite build into static HTML per
// public route so crawlers (Google, Bing, GPTBot, ClaudeBot, PerplexityBot) and
// link unfurlers see real content and per-page meta without running JS.
//
// Runs after `vite build` (client → dist/) and `vite build --ssr` (→ dist-ssr/).
// Writes:
//   dist/<route>/index.html   prerendered public pages
//   dist/404.html             served by Vercel with a real 404 status
//   dist/app.html             unrendered SPA shell for /dashboard (noindex)
//   dist/sitemap.xml, dist/llms.txt, dist/llms-full.txt
//   dist/docs/<slug>.md       raw markdown for each docs page
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const SITE = "https://openeye.sh";

// Browser globals some providers read during render. Effects never run in
// renderToString, so these only need to satisfy synchronous reads.
const memoryStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoryStorage.has(k) ? memoryStorage.get(k) : null),
  setItem: (k, v) => memoryStorage.set(k, String(v)),
  removeItem: (k) => memoryStorage.delete(k),
  clear: () => memoryStorage.clear(),
};
globalThis.sessionStorage = globalThis.localStorage;

const { render, blogPosts, docEntries, docDescription, registryModels } = await import(
  pathToFileURL(path.join(root, "dist-ssr", "entry-server.js")).href
);

const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const HEAD_RE = /<!--page-head-->[\s\S]*?<!--\/page-head-->/;
if (!HEAD_RE.test(template) || !template.includes("<!--app-html-->")) {
  throw new Error("index.html is missing the <!--page-head--> / <!--app-html--> markers");
}

// Indexable pages, in sitemap order. `priority`/`changefreq` feed sitemap.xml.
const pages = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/docs", priority: "0.9", changefreq: "weekly" },
  { path: "/models", priority: "0.8", changefreq: "weekly" },
  { path: "/pricing", priority: "0.8", changefreq: "monthly" },
  { path: "/blog", priority: "0.8", changefreq: "weekly" },
  { path: "/use-cases", priority: "0.7", changefreq: "monthly" },
  { path: "/architecture", priority: "0.7", changefreq: "monthly" },
  { path: "/about", priority: "0.7", changefreq: "monthly" },
  { path: "/changelog", priority: "0.6", changefreq: "weekly" },
  { path: "/community", priority: "0.6", changefreq: "monthly" },
  { path: "/demo", priority: "0.6", changefreq: "monthly" },
  ...docEntries.map((d) => ({ path: `/docs/${d.id}`, priority: "0.7", changefreq: "monthly" })),
  ...registryModels.map((m) => ({ path: `/models/${m.slug}`, priority: "0.7", changefreq: "monthly" })),
  ...blogPosts.map((p) => ({ path: `/blog/${p.slug}`, priority: "0.6", changefreq: "yearly", lastmod: p.date })),
  { path: "/terms", priority: "0.3", changefreq: "yearly" },
  { path: "/privacy", priority: "0.3", changefreq: "yearly" },
];
// Prerendered for crawlers/unfurlers but kept out of the sitemap.
const unlisted = ["/login", "/presentation", "/hackathon"];

function page(url) {
  const { html, head } = render(url);
  return template.replace(HEAD_RE, head).replace("<!--app-html-->", html);
}

function write(rel, contents) {
  const file = path.join(dist, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

// SPA shell first, before index.html is overwritten by the homepage render.
write(
  "app.html",
  template
    .replace(HEAD_RE, '<title>OpenEye</title>\n    <meta name="robots" content="noindex" />')
    .replace("<!--app-html-->", ""),
);

for (const { path: url } of pages) {
  write(url === "/" ? "index.html" : `${url.slice(1)}/index.html`, page(url));
}
for (const url of unlisted) write(`${url.slice(1)}/index.html`, page(url));
write("404.html", page("/404"));

// sitemap.xml
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (p) =>
      `  <url><loc>${SITE}${p.path}</loc><lastmod>${p.lastmod ?? today}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`,
  )
  .join("\n")}
</urlset>
`;
write("sitemap.xml", sitemap);

// Raw docs markdown, linked from llms.txt so agents can fetch clean text.
const docsSrc = path.join(root, "src", "data", "docs");
const docMarkdown = new Map();
for (const d of docEntries) {
  const raw = fs.readFileSync(path.join(docsSrc, `${d.id}.md`), "utf8");
  const body = raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
  const md = `# ${d.title}\n\nSource: ${SITE}/docs/${d.id}\n\n${body}\n`;
  docMarkdown.set(d.id, md);
  write(`docs/${d.id}.md`, md);
}

// llms.txt — https://llmstxt.org
const groups = [...new Set(docEntries.map((d) => d.group))];
const llms = `# OpenEye

> Open-source "Ollama for vision": a CLI-first perception engine that turns raw video into structured world models for robots, VLA models, and autonomous agents. Install with \`pipx install openeye-sh\`.

OpenEye runs vision models (YOLO, RF-DETR, Grounding DINO, Depth Anything V2, SAM 2, SmolVLA) locally on CPU, NVIDIA CUDA, or Apple Silicon. \`openeye pull <model>\` downloads weights, \`openeye run <model> <image>\` prints JSON, and \`openeye serve <model>\` exposes REST and WebSocket APIs. Source at https://github.com/aw3-technology/openeye.sh. Full docs as one file: ${SITE}/llms-full.txt

- Hosted API: \`https://openeye.sh/v1\` with \`Authorization: Bearer oe_...\` (keys at ${SITE}/dashboard/settings/api-keys). \`POST /v1/detect\` (YOLOv8, 1 credit), \`GET /v1/models\`, \`GET /v1/usage\`; \`/v1/describe\` returns 503 until enabled; depth and streaming are self-hosted only. CLI: \`openeye api detect <image>\` with \`OPENEYE_API_KEY\`.
- MCP server: \`openeye-mcp\` (install \`openeye-sh[mcp]\`) exposes local tools (openeye_list, openeye_pull, openeye_run, openeye_serve, openeye_health, openeye_bench, openeye_remove, openeye_nebius_stats) and hosted tools (openeye_api_detect, openeye_api_describe, openeye_api_models, openeye_api_usage; need \`OPENEYE_API_KEY\`).
- Dashboard: ${SITE}/dashboard for API keys, credits, inference history, fleet management and observation memory; connect it to a local \`openeye serve\` at http://localhost:8000 for live inference.

${groups
  .map(
    (g) =>
      `## ${g}\n\n${docEntries
        .filter((d) => d.group === g)
        .map((d) => `- [${d.title}](${SITE}/docs/${d.id}.md): ${docDescription(d)}`)
        .join("\n")}`,
  )
  .join("\n\n")}

## Models

${registryModels.map((m) => `- [${m.name}](${SITE}/models/${m.slug}): ${m.summary} \`openeye pull ${m.slug}\``).join("\n")}

## Blog

${blogPosts.map((p) => `- [${p.title}](${SITE}/blog/${p.slug}): ${p.excerpt}`).join("\n")}

## Optional

- [Pricing](${SITE}/pricing): Free open-source CLI plus hosted API plans.
- [Architecture](${SITE}/architecture): System design, inference pipeline, and fleet management.
- [Use Cases](${SITE}/use-cases): Robotics, industrial safety, drone navigation, and home automation.
- [Changelog](${SITE}/changelog): Version history and release notes.
- [About](${SITE}/about): Mission, team, and project history.
`;
write("llms.txt", llms);
write(
  "llms-full.txt",
  `# OpenEye documentation\n\n> Every page of ${SITE}/docs in one file.\n\n${[...docMarkdown.values()].join("\n---\n\n")}`,
);

console.log(
  `prerender: ${pages.length + unlisted.length} pages, 404.html, app.html, sitemap (${pages.length} urls), llms.txt, ${docMarkdown.size} docs .md`,
);
