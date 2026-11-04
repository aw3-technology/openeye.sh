import type { IncomingMessage, ServerResponse } from "node:http";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./_lib/auth.js";
import { restoreRewrittenUrl } from "./_lib/http.js";

const authHandler = toNodeHandler(auth);

export default function handler(req: IncomingMessage, res: ServerResponse) {
  restoreRewrittenUrl(req, "/api/auth");
  return authHandler(req, res);
}
