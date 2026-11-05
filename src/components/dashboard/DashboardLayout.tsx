import { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "./DashboardSidebar";
import { ConnectionStatus } from "./ConnectionStatus";
import { CreditBalanceBadge } from "./CreditBalanceBadge";
import { ThemeToggle } from "./ThemeToggle";
import { useSyncCredUser } from "@/hooks/useCredits";
import { useAuth } from "@/hooks/useAuth";

export function DashboardLayout() {
  const { user } = useAuth();
  const syncUser = useSyncCredUser();
  const lastSyncedId = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (lastSyncedId.current === user.id) return;
    lastSyncedId.current = user.id;
    syncUser.mutate();
    // Re-sync when user identity changes (e.g. sign-out / sign-in)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-foreground/[0.07] bg-background/80 px-4 backdrop-blur-sm">
          <SidebarTrigger />
          <div className="flex-1" />
          <ThemeToggle />
          <CreditBalanceBadge />
          <ConnectionStatus />
        </header>
        <div className="flex-1 overflow-auto px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
