import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { HelmetProvider, type HelmetServerState } from "react-helmet-async";
import { AppProviders, AppRoutes } from "./App";

export { blogPosts } from "./data/blogPosts";
export { docEntries, docDescription } from "./data/docsContent";
export { registryModels } from "./data/modelRegistry";

/**
 * Build-time render of one public route to HTML + head tags.
 * Driven by scripts/prerender.mjs after `vite build`.
 */
export function render(url: string): { html: string; head: string } {
  const helmetContext: { helmet?: HelmetServerState } = {};
  const html = renderToString(
    <HelmetProvider context={helmetContext}>
      <AppProviders>
        <StaticRouter location={url}>
          <AppRoutes />
        </StaticRouter>
      </AppProviders>
    </HelmetProvider>,
  );
  const h = helmetContext.helmet;
  const head = h
    ? [h.title, h.meta, h.link, h.script].map((part) => part.toString()).filter(Boolean).join("\n    ")
    : "";
  return { html, head };
}
