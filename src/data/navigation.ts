import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ImagePlus,
  Video,
  History,
  SlidersHorizontal,
  BarChart3,
  Download,
  Key,
  FileCode,
  GitBranch,
  FlaskConical,
  Coins,
  Radio,
  Rocket,
  Users,
  Wrench,
  Bell,
  Bot,
  Brain,
  Tv2,
  Crosshair,
  Shield,
  Cpu,
  Gauge,
} from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
}

export interface DashboardNavItem {
  label: string;
  icon: LucideIcon;
  path: string;
}

/** Public site navigation (Navbar) */
export const publicNavLinks: NavLink[] = [
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
];

/** Dashboard sidebar — main section */
export const dashboardNavItems: DashboardNavItem[] = [
  { label: "Live Demo", icon: Tv2, path: "/dashboard/demo" },
  { label: "Agentic Loop", icon: Crosshair, path: "/dashboard/agentic" },
  { label: "Overview", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Inference", icon: ImagePlus, path: "/dashboard/inference" },
  { label: "Live Stream", icon: Video, path: "/dashboard/live" },
  { label: "History", icon: History, path: "/dashboard/history" },
  { label: "Models", icon: Cpu, path: "/dashboard/models" },
  { label: "Model Settings", icon: SlidersHorizontal, path: "/dashboard/settings" },
  { label: "Benchmark", icon: Gauge, path: "/dashboard/benchmark" },
  { label: "Metrics", icon: BarChart3, path: "/dashboard/metrics" },
  { label: "Scene Graph", icon: GitBranch, path: "/dashboard/scene-graph" },
  { label: "Export", icon: Download, path: "/dashboard/export" },
  { label: "API Keys", icon: Key, path: "/dashboard/api-keys" },
  { label: "Config Editor", icon: FileCode, path: "/dashboard/config" },
  { label: "MLOps", icon: FlaskConical, path: "/dashboard/mlops" },
  { label: "Credits", icon: Coins, path: "/dashboard/credits" },
  { label: "Agent Loop", icon: Bot, path: "/dashboard/agent" },
  { label: "Memory", icon: Brain, path: "/dashboard/memory" },
  { label: "Governance", icon: Shield, path: "/dashboard/governance" },
];

/** Dashboard sidebar — fleet management section */
export const fleetNavItems: DashboardNavItem[] = [
  { label: "Fleet Overview", icon: Radio, path: "/dashboard/fleet" },
  { label: "Deployments", icon: Rocket, path: "/dashboard/fleet/deployments" },
  { label: "Device Groups", icon: Users, path: "/dashboard/fleet/groups" },
  { label: "Maintenance", icon: Wrench, path: "/dashboard/fleet/maintenance" },
  { label: "Alerts", icon: Bell, path: "/dashboard/fleet/alerts" },
];

export const GITHUB_URL = "https://github.com/openeye-ai";
