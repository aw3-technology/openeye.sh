import { useEffect, useMemo, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useLocation } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DocsSidebar, SidebarNav } from "@/components/docs/DocsSidebar";
import { DocsContent } from "@/components/docs/DocsContent";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { docsContent } from "@/data/docsContent";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function Docs() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const location = useLocation();

  usePageMeta("Documentation", [], false);

  const sectionIds = useMemo(
    () => docsContent.flatMap((g) => g.sections.map((s) => s.id)),
    []
  );

  const activeId = useScrollSpy(sectionIds);

  // Handle deep linking on mount and hash changes
  useEffect(() => {
    const hash = location.hash.slice(1);
    if (hash) {
      // Double rAF to ensure content is painted before scrolling
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = document.getElementById(hash);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      });
    }
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <div className="pt-20 pb-8 px-4 border-b border-foreground/[0.06]">
        <div className="container max-w-6xl mx-auto">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Documentation
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold font-display">
            OpenEye Docs
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Everything you need to install, configure, and build with OpenEye.
          </p>
        </div>
      </div>

      {/* Mobile sidebar trigger */}
      <div className="lg:hidden sticky top-14 z-40 bg-background/80 backdrop-blur-sm border-b border-foreground/[0.06]">
        <div className="container max-w-6xl mx-auto px-4 py-2">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="text-current"
                >
                  <path
                    d="M2 4h12M2 8h12M2 12h12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Navigation
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 pt-12">
              <SheetTitle className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-6">
                Documentation
              </SheetTitle>
              <SidebarNav
                activeId={activeId}
                onSelect={() => setSheetOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main content */}
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[240px_1fr] gap-12">
          {/* Desktop sidebar */}
          <div className="hidden lg:block">
            <DocsSidebar activeId={activeId} />
          </div>

          {/* Content */}
          <div className="min-w-0">
            <DocsContent />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
