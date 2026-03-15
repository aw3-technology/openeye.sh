import { useState } from "react";
import { motion } from "framer-motion";
import { lovable } from "@/integrations/lovable/index";
import logoVertical from "@/assets/openeye-logo-vertical.png";

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (provider: "google" | "apple") => {
    setLoading(provider);
    setError(null);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result?.error) {
      setError(result.error.message || "Sign-in failed");
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <img src={logoVertical} alt="OpenEye" className="h-20 mx-auto mb-6" />
          <h1 className="text-2xl font-semibold font-display mb-2">Sign in to OpenEye</h1>
          <p className="text-sm text-muted-foreground">
            Access the open-source perception engine.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleSignIn("google")}
            disabled={!!loading}
            className="w-full flex items-center justify-center gap-3 bg-card border border-foreground/[0.06] rounded-inner px-4 py-3 text-sm font-medium hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {loading === "google" ? "Signing in..." : "Continue with Google"}
          </button>

          <button
            onClick={() => handleSignIn("apple")}
            disabled={!!loading}
            className="w-full flex items-center justify-center gap-3 bg-foreground text-background rounded-inner px-4 py-3 text-sm font-medium hover:bg-foreground/90 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M14.94 9.88c-.02-2.08 1.7-3.08 1.78-3.13-0.97-1.42-2.48-1.61-3.01-1.63-1.28-0.13-2.5 0.75-3.15 0.75s-1.65-0.73-2.71-0.71c-1.39 0.02-2.68 0.81-3.4 2.06-1.45 2.51-0.37 6.24 1.04 8.28 0.69 1 1.51 2.12 2.59 2.08 1.04-0.04 1.43-0.67 2.69-0.67s1.61 0.67 2.71 0.65c1.12-0.02 1.82-1.02 2.5-2.02 0.79-1.16 1.11-2.28 1.13-2.34-0.02-0.01-2.17-0.83-2.19-3.3zM12.89 3.42c0.57-0.69 0.96-1.65 0.85-2.6-0.82 0.03-1.82 0.55-2.41 1.24-0.53 0.61-0.99 1.59-0.87 2.52 0.92 0.07 1.85-0.46 2.43-1.16z"/>
            </svg>
            {loading === "apple" ? "Signing in..." : "Continue with Apple"}
          </button>
        </div>

        {error && (
          <p className="mt-4 text-sm text-center text-destructive">{error}</p>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          By signing in, you agree to OpenEye's open-source terms.
        </p>
      </motion.div>
    </div>
  );
}
