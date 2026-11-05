import { useState, type ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageHero } from "@/components/PageHero";
import { DocsSidebar, SidebarNav } from "@/components/docs/DocsSidebar";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** Shared chrome for /docs and /docs/:slug: header, sidebar, mobile nav. */
export function DocsLayout({ activeId, showHeader = true, children }: { activeId?: string; showHeader?: boolean; children: ReactNode }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>

      {showHeader ? (
        <PageHero size="sm" titleAs="div" eyebrow="Documentation" title="OpenEye Docs">
          Everything you need to install, configure, and build with OpenEye.
        </PageHero>
      ) : (
        <div className="pt-14" />
      )}

      {/* Mobile sidebar trigger */}
      <div className="lg:hidden sticky top-14 z-40 bg-background/80 backdrop-blur-sm border-b border-foreground/[0.06]">
        <div className="container max-w-6xl mx-auto px-4 py-2">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button className="flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors">
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
              <SheetTitle className="font-mono text-xs text-muted-foreground mb-6">
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
      <div className="container max-w-6xl mx-auto px-4 py-10 md:py-12">
        <div className="grid lg:grid-cols-[240px_1fr] gap-12">
          {/* Desktop sidebar */}
          <div className="hidden lg:block">
            <DocsSidebar activeId={activeId} />
          </div>

          {/* Content */}
          <div className="min-w-0">{children}</div>
        </div>
      </div>

      </main>
      <Footer />
    </div>
  );
}
