import type { IncomingMessage, ServerResponse } from "node:http";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../_lib/auth.js";

// 1Profile brokers these sign-in methods; ?connection= on its authorize URL skips its picker.
const CONNECTIONS = new Set(["google", "azure", "apple", "github"]);

/**
 * GET /api/signin/1profile?connection=google&callbackURL=/dashboard
 * Starts the normal 1Profile OAuth flow (PKCE + state cookies from Better Auth) and sends the
 * browser to 1Profile with the chosen method preselected. Without `connection`, 1Profile shows its
 * own sign-in page.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const connection = url.searchParams.get("connection");
  const next = url.searchParams.get("callbackURL");
  const callbackURL = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const response = await auth.api.signInSocial({
    body: { provider: "1profile", callbackURL, errorCallbackURL: "/login" },
    headers: fromNodeHeaders(req.headers),
    asResponse: true,
  });
  const data = (await response.json().catch(() => ({}))) as { url?: string };

  res.setHeader("Cache-Control", "no-store");
  const cookies = response.headers.getSetCookie();
  if (cookies.length) res.setHeader("Set-Cookie", cookies);
  if (!data.url) {
    res.writeHead(302, { Location: "/login?error=signin_unavailable" }).end();
    return;
  }
  const target = new URL(data.url);
  if (connection && CONNECTIONS.has(connection)) target.searchParams.set("connection", connection);
  res.writeHead(302, { Location: target.toString() }).end();
}
