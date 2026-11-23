import type { IncomingMessage } from "node:http";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import { HttpError } from "./http.js";

// Kept out of http.ts so routes that never read a session (api/v1.ts) don't
// load Better Auth: its init starts a 1Profile discovery fetch and a schema
// check that a /v1 request never awaits, so they were frozen with the instance
// and logged "Discovery fetch failed" on most /v1 cold starts.

/** Returns the signed-in user, or throws 401. */
export async function requireUser(req: IncomingMessage) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) throw new HttpError(401, "Not authenticated");
  return session.user;
}
