import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logoLight from "@/assets/openeye-logo-horizontal.png";
import logoDark from "@/assets/openeye-logo-horizontal-dark.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { publicNavLinks, GITHUB_URL } from "@/data/navigation";

export function Navbar() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + "/");

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-foreground/[0.06]">
      <div className="container max-w-6xl mx-auto flex items-center justify-between h-14 px-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoDark} alt="OpenEye" className="h-6 logo-dark" />
          <img src={logoLight} alt="OpenEye" className="h-6 logo-light" />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {publicNavLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className={`transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-foreground/50 outline-none ${
                isActive(link.href)
                  ? "text-foreground"
                  : "hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {user && (
            <Link
              to="/dashboard"
              className={`transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-foreground/50 outline-none ${
                isActive("/dashboard")
                  ? "text-foreground"
                  : "hover:text-foreground"
              }`}
            >
              Dashboard
            </Link>
          )}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-foreground/50 outline-none"
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
                    alt={`${user.user_metadata?.full_name || "User"} avatar`}
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <span className="text-foreground normal-case tracking-normal text-xs">
                  {user.user_metadata?.full_name || user.email}
                </span>
                <button
                  onClick={signOut}
                  className="text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-foreground/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background outline-none rounded-sm"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-inner hover:bg-primary/90 transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background outline-none"
              >
                Sign In
              </button>
            )
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden flex flex-col items-center justify-center gap-2 p-3 overflow-visible"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          <motion.span
            className="block w-5 h-px bg-foreground origin-center"
            animate={mobileOpen ? { rotate: 45, y: 5 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.15 }}
          />
          <motion.span
            className="block w-5 h-px bg-foreground origin-center"
            animate={mobileOpen ? { rotate: -45, y: -5 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.15 }}
          />
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="md:hidden overflow-hidden border-t border-foreground/[0.06] bg-background/95 backdrop-blur-sm"
          >
            <div className="px-4 py-4 space-y-1 font-mono text-sm">
              {publicNavLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block py-2.5 transition-colors uppercase tracking-widest text-xs ${
                    isActive(link.href)
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {user && (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className={`block py-2.5 transition-colors uppercase tracking-widest text-xs ${
                    isActive("/dashboard")
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Dashboard
                </Link>
              )}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileOpen(false)}
                className="block py-2.5 text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest text-xs"
              >
                GitHub
              </a>

              <div className="pt-3 border-t border-foreground/[0.06]">
                {!loading && (
                  user ? (
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        {user.user_metadata?.avatar_url && (
                          <img
                            src={user.user_metadata.avatar_url}
                            alt={`${user.user_metadata?.full_name || "User"} avatar`}
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <span className="text-xs text-foreground">
                          {user.user_metadata?.full_name || user.email}
                        </span>
                      </div>
                      <button
                        onClick={() => { signOut(); setMobileOpen(false); }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-foreground/50 rounded-sm outline-none"
                      >
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { navigate("/login"); setMobileOpen(false); }}
                      className="w-full bg-foreground text-background px-4 py-2.5 rounded-inner text-xs font-medium hover:bg-foreground/90 transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-foreground/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background outline-none"
                    >
                      Sign In
                    </button>
                  )
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
