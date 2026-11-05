import { betterAuth } from "better-auth";
import type { SocialProviders } from "better-auth/social-providers";
import { pool } from "./db.js";

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
  account: {
    // Users imported from Lovable Cloud have no password; let them sign in
    // with Google/Apple on the same email and get linked to their account.
    accountLinking: { enabled: true, trustedProviders: ["google", "apple"] },
  },
  advanced: {
    // Keep UUID ids so imported Supabase user ids stay valid.
    database: { generateId: () => crypto.randomUUID() },
  },
});

export type Session = typeof auth.$Infer.Session;
