import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { LayoutDashboard, LogOut, ChevronRight } from "lucide-react";
import logoLight from "@/assets/openeye-logo-horizontal.png";
import logoDark from "@/assets/openeye-logo-horizontal-dark.png";
import {
  dashboardSidebarItems,
  fleetNavItems,
  isNavGroup,
  type DashboardNavItem,
  type DashboardNavGroup,
} from "@/data/navigation";

function isItemActive(path: string, pathname: string) {
  if (path === "/dashboard") return pathname === "/dashboard";
  return pathname === path || pathname.startsWith(path + "/");
}

function isGroupActive(group: DashboardNavGroup, pathname: string) {
  return group.items.some((item) => isItemActive(item.path, pathname));
}

function NavItemLink({ item, pathname }: { item: DashboardNavItem; pathname: string }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isItemActive(item.path, pathname)}
        tooltip={item.label}
      >
        <Link to={item.path}>
          <item.icon className="h-4 w-4" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavGroupCollapsible({ group, pathname }: { group: DashboardNavGroup; pathname: string }) {
  const active = isGroupActive(group, pathname);

  return (
    <Collapsible defaultOpen={active} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={group.label} isActive={active}>
            <group.icon className="h-4 w-4" />
            <span>{group.label}</span>
            <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {group.items.map((child) => (
              <SidebarMenuSubItem key={child.path}>
                <SidebarMenuSubButton
                  asChild
                  size="sm"
                  isActive={isItemActive(child.path, pathname)}
                >
                  <Link to={child.path}>
                    <span>{child.label}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function DashboardSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 px-2 py-1">
          <img src={logoDark} alt="OpenEye" className="h-5 logo-dark group-data-[collapsible=icon]:hidden" />
          <img src={logoLight} alt="OpenEye" className="h-5 logo-light group-data-[collapsible=icon]:hidden" />
          <LayoutDashboard className="h-5 w-5 hidden group-data-[collapsible=icon]:block" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dashboardSidebarItems.map((item) =>
                isNavGroup(item) ? (
                  <NavGroupCollapsible
                    key={item.label}
                    group={item}
                    pathname={location.pathname}
                  />
                ) : (
                  <NavItemLink
                    key={item.path}
                    item={item}
                    pathname={location.pathname}
                  />
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Fleet Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {fleetNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.path === "/dashboard/fleet"
                        ? location.pathname === "/dashboard/fleet"
                        : location.pathname.startsWith(item.path)
                    }
                    tooltip={item.label}
                  >
                    <Link to={item.path}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location.pathname === "/dashboard/profile"}
              tooltip={user?.user_metadata?.full_name || user?.email || "User"}
            >
              <Link to="/dashboard/profile">
                {user?.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt=""
                    className="h-5 w-5 rounded-full"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="h-5 w-5 rounded-full bg-muted" />
                )}
                <span className="truncate text-xs">
                  {user?.user_metadata?.full_name || user?.email}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut().catch(() => { /* sign-out best effort */ })} tooltip="Sign Out">
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
