import { createAuthClient } from "better-auth/react";

/** Better Auth client; the server lives at /api/auth (api/auth.ts). */
const client = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
  basePath: "/api/auth",
});

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  createdAt: Date | string;
}

type Result<T = unknown> = Promise<{ data: T | null; error: { message?: string } | null }>;

/**
 * Typed facade over the methods the app uses. Better Auth's inferred client
 * types require `strict` TypeScript, which tsconfig.app.json does not enable,
 * so they collapse to `never` here.
 */
interface AuthClient {
  useSession(): { data: { user: SessionUser } | null; isPending: boolean };
  signOut(): Result;
  signIn: {
    email(body: { email: string; password: string }): Result;
    social(body: { provider: "1profile" | "google" | "apple"; callbackURL?: string; errorCallbackURL?: string }): Result;
  };
  signUp: {
    email(body: { email: string; password: string; name: string }): Result;
  };
  updateUser(body: { name?: string; image?: string | null }): Result;
  listAccounts(): Result<Array<{ providerId: string }>>;
}

export const authClient = client as unknown as AuthClient;
