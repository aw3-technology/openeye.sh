import type { IncomingMessage, ServerResponse } from "node:http";
import { toNodeHandler } from "better-auth/node";
import { getAuth } from "./_lib/auth.js";
import { restoreRewrittenUrl } from "./_lib/http.js";

let authHandler: ReturnType<typeof toNodeHandler> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  restoreRewrittenUrl(req, "/api/auth");
  authHandler ??= toNodeHandler(await getAuth());
  return authHandler(req, res);
}
