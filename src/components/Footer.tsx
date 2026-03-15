import { Link } from "react-router-dom";

const productLinks = [
  { label: "Use Cases", to: "/use-cases" },
  { label: "Docs", to: "/docs" },
  { label: "API Reference", to: "/docs#hosted-authentication" },
  { label: "Pricing", to: "/pricing" },
];

const resourceLinks = [
  { label: "Blog", to: "/blog" },
  { label: "Changelog", to: "/changelog" },
  { label: "Community", to: "/community" },
];

type InternalLink = { label: string; to: string };
type ExternalLink = { label: string; href: string };
type CompanyLink = InternalLink | ExternalLink;

const companyLinks: CompanyLink[] = [
  { label: "About", to: "/about" },
  { label: "GitHub", href: "https://github.com/aw3-technology/openeye.sh" },
];

export function Footer() {
  return (
    <footer className="border-t border-foreground/[0.06] py-12 px-4">
      <div className="container max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
              Product
            </div>
            <ul className="space-y-2">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-foreground/50 outline-none"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
              Resources
            </div>
            <ul className="space-y-2">
              {resourceLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-foreground/50 outline-none"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
              Company
            </div>
            <ul className="space-y-2">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  {"to" in link ? (
                    <Link
                      to={link.to}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-foreground/50 outline-none"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-foreground/50 outline-none"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
              Get Started
            </div>
            <div className="font-mono text-xs sm:text-sm bg-secondary text-oe-green px-3 sm:px-4 py-2.5 rounded-inner border overflow-x-auto whitespace-nowrap scrollbar-hide select-all cursor-text">
              pip install openeye-ai
            </div>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-foreground/[0.06]">
          <div className="font-mono text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} AW3 Technology, Inc. Apache 2.0 License.
          </div>
          <div className="flex items-center gap-6 font-mono text-xs text-muted-foreground">
            <a
              href="https://github.com/aw3-technology/openeye.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-foreground/50 outline-none"
            >
              GitHub
            </a>
            <span>openeye.sh</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
