import { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "./DashboardSidebar";
import { ConnectionStatus } from "./ConnectionStatus";
import { CreditBalanceBadge } from "./CreditBalanceBadge";
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
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <div className="flex-1" />
          <CreditBalanceBadge />
          <ConnectionStatus />
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
