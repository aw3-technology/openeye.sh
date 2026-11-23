// api/signin/1profile.ts and Better Auth's OAuth callback send failures back as /login?error=<code>.
export function oauthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  if (code === "signin_unavailable") {
    return "Single sign-on is briefly unavailable. Try again in a moment, or use email and password.";
  }
  if (code === "access_denied") return "Sign-in was cancelled.";
  return "Sign-in didn't complete. Please try again.";
}

// Better Auth answers a wrong password and an unknown email the same way, so point at both fixes.
export function emailAuthErrorMessage(error: { code?: string; message?: string }, isCloud: boolean): string {
  if (error.code === "INVALID_EMAIL_OR_PASSWORD") {
    return isCloud
      ? "Invalid email or password. If you signed up with Google, GitHub, Apple or Microsoft, use that button above; if you're new, create an account below."
      : "Invalid email or password. If you're new, create an account below.";
  }
  return error.message || "Sign-in failed";
}
