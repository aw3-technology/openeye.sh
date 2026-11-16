import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import type { Plugin } from "vite";

// Viziera (index.html's sdk.js tag) reports page views and JS errors to the
// production app, so only production deploys keep it: local dev and Vercel
// previews drop the tag (VIZIERA_LOCAL=1 keeps it to try the integration).
// Production builds tag every event with the deploy's commit.
function vizieraTag(): Plugin {
  let serve = false;
  return {
    name: "viziera-tag",
    configResolved(config) {
      serve = config.command === "serve";
    },
    transformIndexHtml(html) {
      const tag = /[ \t]*<!-- Usage analytics \(Viziera\)[^\n]*\n[ \t]*<script defer src="https:\/\/viziera\.ai\/api\/v1\/sdk\.js"[^>]*><\/script>\n?/;
      const production = process.env.VERCEL_ENV === "production" || process.env.VIZIERA_LOCAL === "1";
      if (serve ? process.env.VIZIERA_LOCAL !== "1" : !production) return html.replace(tag, "");
      const release = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 12);
      return release ? html.replace('src="https://viziera.ai/api/v1/sdk.js"', `src="https://viziera.ai/api/v1/sdk.js" data-app-version="${release}"`) : html;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), vizieraTag()],
  ssr: {
    // CJS packages whose named exports Node can't resolve; bundle them into
    // the prerender build (scripts/prerender.mjs) instead.
    noExternal: ["react-helmet-async"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
