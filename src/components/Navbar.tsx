import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import logoLight from "@/assets/openeye-logo-horizontal.png";
import logoDark from "@/assets/openeye-logo-horizontal-dark.png";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Navbar() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-foreground/[0.06]">
      <div className="container max-w-6xl mx-auto flex items-center justify-between h-14 px-4">
        <a href="/" className="flex items-center gap-2">
          <img src={logoDark} alt="OpenEye" className="h-6 hidden dark:block" />
          <img src={logoDark} alt="OpenEye" className="h-6 block light:hidden" />
          <img src={logoLight} alt="OpenEye" className="h-6 hidden light:block" />
        </a>
        <div className="hidden md:flex items-center gap-8 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <a href="#demo" className="hover:text-foreground transition-colors">Models</a>
          <a href="#architecture" className="hover:text-foreground transition-colors">Architecture</a>
          <a href="#cli" className="hover:text-foreground transition-colors">CLI</a>
          <a
            href="https://github.com/openeye-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            GitHub
          </a>
          <ThemeToggle />

          {!loading && (
            user ? (
              <div className="flex items-center gap-3">
                {user.user_metadata?.avatar_url && (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt=""
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <span className="text-foreground normal-case tracking-normal text-xs">
                  {user.user_metadata?.full_name || user.email}
                </span>
                <button
                  onClick={signOut}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-inner hover:bg-primary/90 transition-colors active:scale-[0.98]"
              >
                Sign In
              </button>
            )
          )}
        </div>
      </div>
    </nav>
  );
}
