import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import type { SocialProviders } from "better-auth/social-providers";
import { pool } from "./db.js";

const ONEPROFILE_ISSUER =
  process.env.ONEPROFILE_ISSUER || "https://lluoavnspwejosiuqymg.supabase.co/functions/v1/oauth";
const ONEPROFILE_DISCOVERY_URL = `${ONEPROFILE_ISSUER}/.well-known/openid-configuration`;

// Better Auth fetches the discovery document once while it initializes and, if
// that fails, skips the provider until the next 1Profile sign-in retries it. On
// Vercel the first outbound fetch of a fresh instance often fails within ~10 ms
// ("TypeError: fetch failed") and the next one works, so warm the connection
// first, with one retry, and log the underlying cause if both attempts fail.
async function warmOneProfileDiscovery() {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(ONEPROFILE_DISCOVERY_URL, { signal: AbortSignal.timeout(3_000) });
      await res.arrayBuffer();
      if (!res.ok) console.warn(`[auth] 1Profile discovery returned HTTP ${res.status}`);
      return;
    } catch (err) {
      if (attempt === 2) {
        console.warn(`[auth] 1Profile discovery failed twice: ${err}; cause: ${(err as { cause?: unknown }).cause}`);
      }
    }
  }
}
await warmOneProfileDiscovery();

const vercelHost =
  process.env.VERCEL_ENV === "production"
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
    : process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;

// Used for OAuth callback URLs. Set BETTER_AUTH_URL=https://openeye.sh in production.
const baseURL = process.env.BETTER_AUTH_URL || (vercelHost ? `https://${vercelHost}` : "http://localhost:8080");

// Social providers are only enabled when their credentials are configured.
const socialProviders: SocialProviders = {};
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  socialProviders.apple = {
    clientId: process.env.APPLE_CLIENT_ID,
    clientSecret: process.env.APPLE_CLIENT_SECRET,
  };
}

export const auth = betterAuth({
  database: pool,
  baseURL,
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    "https://openeye.sh",
    "https://www.openeye.sh",
    "https://appleid.apple.com",
    "https://1profile.com",
    "http://localhost:3000",
    "http://localhost:8080",
    // Production alias and preview deployments of the openeye project
    "https://openeye-*-aw3technologys-projects.vercel.app",
    ...[process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL]
      .filter(Boolean)
      .map((host) => `https://${host}`),
  ],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  socialProviders,
  plugins: [
    // Sign in with 1Profile (OIDC). OpenEye is a public client (PKCE, no secret), registered
    // with redirect URIs <origin>/api/auth/callback/1profile for openeye.sh and localhost:8080.
    genericOAuth({
      config: [
        {
          providerId: "1profile",
          discoveryUrl: ONEPROFILE_DISCOVERY_URL,
          clientId: process.env.ONEPROFILE_CLIENT_ID ?? "client_5239446173344611bdddf84a23d4cf2b",
          tokenEndpointAuth: { method: "none" },
          pkce: true,
          scopes: ["openid", "email", "profile"],
        },
      ],
    }),
  ],
  account: {
    // Users imported from Lovable Cloud have no password; let them sign in
    // with 1Profile/Google/Apple on the same email and get linked to their account.
    // 1Profile verifies emails, so linking on it is safe.
    accountLinking: { enabled: true, trustedProviders: ["1profile", "google", "apple"] },
  },
  advanced: {
    // Keep UUID ids so imported Supabase user ids stay valid.
    database: { generateId: () => crypto.randomUUID() },
  },
});

export type Session = typeof auth.$Infer.Session;
