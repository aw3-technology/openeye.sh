import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { authClient } from "@/lib/auth-client";
import { PageMeta } from "@/components/seo/PageMeta";
import { useAuth } from "@/hooks/useAuth";
import { isCloudDeployment } from "@/lib/deployment-env";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DetectionField } from "@/components/DetectionField";
import logoHorizontal from "@/assets/openeye-logo-horizontal.png";
import logoHorizontalDark from "@/assets/openeye-logo-horizontal-dark.png";

type AuthMode = "sign_in" | "sign_up";

// Sign-in methods brokered by 1Profile; each button skips 1Profile's picker (api/signin/1profile.ts).
type Connection = "google" | "azure" | "apple" | "github";

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signInAsDemo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isCloud = isCloudDeployment();

  const handleDemoLogin = () => {
    signInAsDemo();
    const from = (location.state as { from?: string })?.from || "/dashboard";
    navigate(from, { replace: true });
  };

  // Full-page navigation: the server sets the OAuth state cookies and redirects to 1Profile.
  const handleOAuthSignIn = (connection?: Connection) => {
    if (!isCloud) return;
    setLoading(connection ?? "1profile");
    setError(null);
    setSuccess(null);
    const from = (location.state as { from?: string })?.from || "/dashboard";
    const params = new URLSearchParams({ callbackURL: from });
    if (connection) params.set("connection", connection);
    window.location.href = `/api/signin/1profile?${params}`;
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading("email");
    setError(null);
    setSuccess(null);

    const { error } =
      mode === "sign_up"
        ? await authClient.signUp.email({ email, password, name: email.split("@")[0] })
        : await authClient.signIn.email({ email, password });
    if (error) {
      setError(error.message || "Sign-in failed");
    } else {
      const from = (location.state as { from?: string })?.from || "/dashboard";
      navigate(from, { replace: true });
    }
    setLoading(null);
  };

  const fieldId = (name: string) => `login-${name}`;

  return (
    <main className="relative min-h-screen bg-background lg:grid lg:grid-cols-2">
      <PageMeta
        title="Sign in | OpenEye"
        description="Sign in to OpenEye to access your dashboard, manage API keys, and monitor inference usage across your perception deployments."
        path="/login"
        noindex
      />

      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden border-r border-foreground/[0.07] bg-card/40 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <DetectionField />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_60%,hsl(var(--primary)/0.14),transparent_60%)]"
        />
        <Link to="/" className="relative inline-flex w-fit">
          <img src={logoHorizontalDark} alt="OpenEye" className="h-6 logo-dark" />
          <img src={logoHorizontal} alt="OpenEye" className="h-6 logo-light" />
        </Link>

        <div className="relative max-w-md">
          <h2 className="font-display text-5xl font-light leading-[1.05] tracking-[-0.015em]">
            See the world
            <span className="block text-primary">the way your agents do.</span>
          </h2>
          <p className="mt-6 text-muted-foreground leading-relaxed">
            Run detection, depth, and segmentation on your own hardware, stream scene graphs to your
            agents, and manage your fleet from one dashboard.
          </p>
          <div className="mt-10 overflow-hidden rounded-xl border border-foreground/10 bg-background/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 border-b border-foreground/[0.07] px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
              <code>
                <span className="text-muted-foreground">$</span> openeye run yolov8 frame.jpg{"\n"}
                <span className="text-muted-foreground">{"{"}</span> <span className="text-primary">"label"</span>: "person", <span className="text-primary">"confidence"</span>: 0.97 <span className="text-muted-foreground">{"}"}</span>{"\n"}
                <span className="text-muted-foreground">{"{"}</span> <span className="text-primary">"label"</span>: "robot_arm", <span className="text-primary">"confidence"</span>: 0.93 <span className="text-muted-foreground">{"}"}</span>
              </code>
            </pre>
          </div>
        </div>

        <p className="relative font-mono text-xs text-muted-foreground/80">
          Free and open source · Self-host or use the hosted API
        </p>
      </aside>

      {/* Form */}
      <div className="relative flex min-h-screen items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-sm"
        >
          <Link to="/" className="mb-10 inline-flex lg:hidden">
            <img src={logoHorizontalDark} alt="OpenEye" className="h-6 logo-dark" />
            <img src={logoHorizontal} alt="OpenEye" className="h-6 logo-light" />
          </Link>

          <h1 className="font-display text-4xl font-light tracking-[-0.015em]">
            {mode === "sign_in" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 mb-8 text-sm text-muted-foreground">
            {mode === "sign_in"
              ? "Sign in to your OpenEye dashboard."
              : "Start running perception in a few minutes."}
          </p>

          {/* OAuth Buttons — cloud only; every provider signs in through 1Profile */}
          {isCloud && (
            <>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => handleOAuthSignIn("google")}
                  disabled={!!loading}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  {loading === "google" ? "Signing in..." : "Continue with Google"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => handleOAuthSignIn("azure")}
                  disabled={!!loading}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18">
                    <path d="M0 0h8.5v8.5H0z" fill="#F25022"/>
                    <path d="M9.5 0H18v8.5H9.5z" fill="#7FBA00"/>
                    <path d="M0 9.5h8.5V18H0z" fill="#00A4EF"/>
                    <path d="M9.5 9.5H18V18H9.5z" fill="#FFB900"/>
                  </svg>
                  {loading === "azure" ? "Signing in..." : "Continue with Microsoft"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => handleOAuthSignIn("apple")}
                  disabled={!!loading}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                    <path d="M14.94 9.88c-.02-2.08 1.7-3.08 1.78-3.13-0.97-1.42-2.48-1.61-3.01-1.63-1.28-0.13-2.5 0.75-3.15 0.75s-1.65-0.73-2.71-0.71c-1.39 0.02-2.68 0.81-3.4 2.06-1.45 2.51-0.37 6.24 1.04 8.28 0.69 1 1.51 2.12 2.59 2.08 1.04-0.04 1.43-0.67 2.69-0.67s1.61 0.67 2.71 0.65c1.12-0.02 1.82-1.02 2.5-2.02 0.79-1.16 1.11-2.28 1.13-2.34-0.02-0.01-2.17-0.83-2.19-3.3zM12.89 3.42c0.57-0.69 0.96-1.65 0.85-2.6-0.82 0.03-1.82 0.55-2.41 1.24-0.53 0.61-0.99 1.59-0.87 2.52 0.92 0.07 1.85-0.46 2.43-1.16z"/>
                  </svg>
                  {loading === "apple" ? "Signing in..." : "Continue with Apple"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => handleOAuthSignIn("github")}
                  disabled={!!loading}
                >
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                  </svg>
                  {loading === "github" ? "Signing in..." : "Continue with GitHub"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => handleOAuthSignIn()}
                  disabled={!!loading}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  {loading === "1profile" ? "Signing in..." : "Continue with 1Profile"}
                </Button>
              </div>
              <Divider label="or with email" />
            </>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={fieldId("email")}>Email</Label>
              <Input
                id={fieldId("email")}
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={fieldId("password")}>Password</Label>
              <Input
                id={fieldId("password")}
                type="password"
                autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                placeholder={mode === "sign_in" ? "Your password" : "At least 6 characters"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11"
              />
            </div>
            <Button type="submit" disabled={!!loading} className="w-full h-11">
              {loading === "email"
                ? "One moment…"
                : mode === "sign_in"
                  ? "Sign in"
                  : "Create account"}
            </Button>
          </form>

          {error && (
            <p role="alert" className="mt-4 text-sm text-center text-destructive">{error}</p>
          )}
          {success && (
            <p className="mt-4 text-sm text-center text-primary">{success}</p>
          )}

          <Divider label="or" />

          <Button variant="outline" className="w-full h-11" onClick={handleDemoLogin} disabled={!!loading}>
            <PlayCircle aria-hidden="true" />
            Explore the demo dashboard
          </Button>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            {mode === "sign_in" ? "New to OpenEye?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => { setMode(mode === "sign_in" ? "sign_up" : "sign_in"); setError(null); setSuccess(null); }}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {mode === "sign_in" ? "Create an account" : "Sign in"}
            </button>
          </p>

          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground/80">
            {isCloud ? (
              <>
                By continuing you agree to the{" "}
                <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">Terms</Link> and{" "}
                <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</Link>.
              </>
            ) : (
              "Running locally — use email/password or the demo dashboard."
            )}
          </p>
        </motion.div>
      </div>
    </main>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
      <div className="h-px flex-1 bg-foreground/[0.07]" />
      {label}
      <div className="h-px flex-1 bg-foreground/[0.07]" />
    </div>
  );
}
