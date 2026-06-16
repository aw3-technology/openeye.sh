import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import logoLight from "@/assets/openeye-logo-horizontal.png";
import logoDark from "@/assets/openeye-logo-horizontal-dark.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { publicMegaMenus, GITHUB_URL } from "@/data/navigation";
import type { MegaMenu, MegaMenuLink } from "@/data/navigation";

function MegaLinkRow({ link, onClick }: { link: MegaMenuLink; onClick?: () => void }) {
  const Icon = link.icon;
  const content = (
    <>
      {Icon && (
        <span className="flex-shrink-0 w-9 h-9 rounded-md border border-foreground/10 bg-foreground/[0.03] flex items-center justify-center text-foreground/70 group-hover:text-foreground group-hover:border-foreground/20 transition-colors">
          <Icon className="w-4 h-4" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground normal-case tracking-normal">
          {link.label}
        </span>
        {link.description && (
          <span className="block text-xs text-muted-foreground normal-case tracking-normal mt-0.5">
            {link.description}
          </span>
        )}
      </span>
    </>
  );
  const className =
    "group flex items-start gap-3 p-2 -mx-2 rounded-md hover:bg-foreground/[0.04] transition-colors";
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
        {content}
      </a>
    );
  }
  return (
    <Link to={link.href} onClick={onClick} className={className}>
      {content}
    </Link>
  );
}

function MegaDropdown({ menu, isActive }: { menu: MegaMenu; isActive: (href: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const vw = window.innerWidth;
      const margin = 16;
      const width = Math.min(640, vw - margin * 2);
      const centerX = rect.left + rect.width / 2;
      let desiredLeft = centerX - width / 2;
      if (desiredLeft < margin) desiredLeft = margin;
      if (desiredLeft + width > vw - margin) desiredLeft = vw - margin - width;
      setOffset(desiredLeft - centerX);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allLinks = menu.columns.flatMap((c) => c.links);
  const hasActive = allLinks.some((l) => !l.external && isActive(l.href));

  const handleEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div ref={ref} className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 uppercase tracking-widest transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-foreground/50 outline-none ${
          hasActive || open ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
        aria-expanded={open}
      >
        {menu.label}
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <div
            className="absolute top-full left-1/2 mt-2 w-[min(640px,calc(100vw-2rem))] z-50"
            style={{ transform: `translateX(calc(-50% + ${offset}px))` }}
          >
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="bg-background border border-foreground/[0.08] rounded-lg shadow-xl overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-6 p-5">
              {menu.columns.map((col) => (
                <div key={col.heading}>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
                    {col.heading}
                  </div>
                  <div className="space-y-1">
                    {col.links.map((link) => (
                      <MegaLinkRow key={link.label} link={link} onClick={() => setOpen(false)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {menu.feature && (
              <div className="border-t border-foreground/[0.06] bg-foreground/[0.02] px-5 py-3">
                <MegaLinkRow link={menu.feature} onClick={() => setOpen(false)} />
              </div>
            )}
          </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Navbar() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + "/");

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-foreground/[0.06]">
      <div className="container max-w-6xl mx-auto flex items-center justify-between h-14 px-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoDark} alt="OpenEye perception engine logo" className="h-6 logo-dark" />
          <img src={logoLight} alt="OpenEye perception engine logo" className="h-6 logo-light" />
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-6 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {publicMegaMenus.map((menu) => (
            <MegaDropdown key={menu.label} menu={menu} isActive={isActive} />
          ))}
          {user && (
            <Link
              to="/dashboard"
              className={`transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-foreground/50 outline-none ${
                isActive("/dashboard") ? "text-foreground" : "hover:text-foreground"
              }`}
            >
              Dashboard
            </Link>
          )}
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
          className="lg:hidden flex flex-col items-center justify-center gap-2 p-3 overflow-visible"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          <motion.span
            className="block w-5 h-px bg-foreground origin-center"
            animate={mobileOpen ? { rotate: 45, y: 4.5 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.15 }}
          />
          <motion.span
            className="block w-5 h-px bg-foreground origin-center"
            animate={mobileOpen ? { rotate: -45, y: -4.5 } : { rotate: 0, y: 0 }}
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
            className="lg:hidden overflow-hidden border-t border-foreground/[0.06] bg-background/95 backdrop-blur-sm max-h-[calc(100vh-3.5rem)] overflow-y-auto"
          >
            <div className="px-4 py-4 space-y-5">
              {publicMegaMenus.map((menu) => (
                <div key={menu.label}>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
                    {menu.label}
                  </div>
                  <div className="space-y-1">
                    {menu.columns.flatMap((c) => c.links).map((link) => (
                      <MegaLinkRow key={link.label} link={link} onClick={() => setMobileOpen(false)} />
                    ))}
                  </div>
                </div>
              ))}
              {user && (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className={`block py-2.5 font-mono transition-colors uppercase tracking-widest text-xs ${
                    isActive("/dashboard")
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Dashboard
                </Link>
              )}

              <div className="pt-3 border-t border-foreground/[0.06]">
                <div className="flex items-center justify-between pb-3">
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileOpen(false)}
                    className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                  >
                    GitHub
                  </a>
                  <ThemeToggle />
                </div>
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
