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
  Settings,
  BookOpen,
  Newspaper,
  ScrollText,
  MessagesSquare,
  Info,
  Presentation as PresentationIcon,
  Boxes,
  Network,
  Sparkles,
  Github,
  Trophy,
  PlayCircle,
  Tag,
} from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
}

export interface NavDropdown {
  label: string;
  items: NavLink[];
}

export interface DashboardNavItem {
  label: string;
  icon: LucideIcon;
  path: string;
}

export interface DashboardNavGroup {
  label: string;
  icon: LucideIcon;
  items: DashboardNavItem[];
}

export type DashboardSidebarItem = DashboardNavItem | DashboardNavGroup;

export function isNavGroup(item: DashboardSidebarItem): item is DashboardNavGroup {
  return "items" in item;
}

export type NavItem = NavLink | NavDropdown;

export function isDropdown(item: NavItem): item is NavDropdown {
  return "items" in item;
}

export const GITHUB_URL = "https://github.com/aw3-technology/openeye.sh";

/** Mega-menu types for the public navbar */
export interface MegaMenuLink {
  href: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  external?: boolean;
}

export interface MegaMenuColumn {
  heading: string;
  links: MegaMenuLink[];
}

export interface MegaMenu {
  label: string;
  columns: MegaMenuColumn[];
  feature?: MegaMenuLink;
}

/** Public site navigation (Navbar) — mega-menu format */
export const publicMegaMenus: MegaMenu[] = [
  {
    label: "Product",
    columns: [
      {
        heading: "Platform",
        links: [
          { href: "/", label: "Overview", description: "Perception engine for agents & robots", icon: Sparkles },
          { href: "/models", label: "Models", description: "YOLO, depth, VLM adapters", icon: Boxes },
          { href: "/architecture", label: "Architecture", description: "How OpenEye fits together", icon: Network },
          { href: "/use-cases", label: "Use Cases", description: "Where teams ship OpenEye", icon: Crosshair },
        ],
      },
      {
        heading: "Try it",
        links: [
          { href: "/demo", label: "Live Demo", description: "Run perception in the browser", icon: PlayCircle },
          { href: "/dashboard", label: "Dashboard", description: "Inference, fleet & metrics", icon: LayoutDashboard },
          { href: "/pricing", label: "Pricing", description: "Free CLI, paid cloud credits", icon: Tag },
        ],
      },
    ],
    feature: {
      href: "/demo",
      label: "Try the Live Demo",
      description: "Stream your camera through OpenEye in under a minute",
      icon: PlayCircle,
    },
  },
  {
    label: "Resources",
    columns: [
      {
        heading: "Learn",
        links: [
          { href: "/docs", label: "Docs", description: "Install, run & integrate", icon: BookOpen },
          { href: "/blog", label: "Blog", description: "Engineering notes & releases", icon: Newspaper },
          { href: "/changelog", label: "Changelog", description: "What shipped recently", icon: ScrollText },
        ],
      },
      {
        heading: "Company",
        links: [
          { href: "/about", label: "About", description: "Mission & team", icon: Info },
          { href: "/community", label: "Community", description: "Join the conversation", icon: MessagesSquare },
          { href: "/presentation", label: "Pitch Deck", description: "The OpenEye story", icon: PresentationIcon },
        ],
      },
    ],
  },
  {
    label: "Developers",
    columns: [
      {
        heading: "Build",
        links: [
          { href: "/docs", label: "Documentation", description: "CLI, API & adapters", icon: BookOpen },
          { href: "/models", label: "Model Registry", description: "Pretrained model catalog", icon: Boxes },
          { href: "/architecture", label: "Architecture", description: "Pipeline internals", icon: Network },
        ],
      },
      {
        heading: "Open source",
        links: [
          { href: GITHUB_URL, label: "GitHub", description: "Star, fork & contribute", icon: Github, external: true },
          { href: "/hackathon", label: "Hackathon", description: "Build on OpenEye", icon: Trophy },
          { href: "/community", label: "Community", description: "Get help from devs", icon: MessagesSquare },
        ],
      },
    ],
    feature: {
      href: GITHUB_URL,
      label: "Star us on GitHub",
      description: "OpenEye is fully open-source — drop a star to follow along",
      icon: Github,
      external: true,
    },
  },
];

/** Legacy flat nav (kept for backward compat with tests/components) */
export const publicNavItems: NavItem[] = [
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
  {
    label: "Resources",
    items: [
      { href: "/demo", label: "Demo" },
      { href: "/presentation", label: "Pitch Deck" },
      { href: "/blog", label: "Blog" },
    ],
  },
];

/** Dashboard sidebar — grouped with collapsible dropdowns */
export const dashboardSidebarItems: DashboardSidebarItem[] = [
  { label: "Overview", icon: LayoutDashboard, path: "/dashboard" },
  {
    label: "Live",
    icon: Tv2,
    items: [
      { label: "Live Demo", icon: Tv2, path: "/dashboard/demo" },
      { label: "Live Stream", icon: Video, path: "/dashboard/live" },
      { label: "Agentic Loop", icon: Crosshair, path: "/dashboard/agentic" },
    ],
  },
  {
    label: "Perception",
    icon: ImagePlus,
    items: [
      { label: "Inference", icon: ImagePlus, path: "/dashboard/inference" },
      { label: "History", icon: History, path: "/dashboard/history" },
      { label: "Scene Graph", icon: GitBranch, path: "/dashboard/scene-graph" },
    ],
  },
  {
    label: "Models",
    icon: Cpu,
    items: [
      { label: "Registry", icon: Cpu, path: "/dashboard/models" },
      { label: "Settings", icon: SlidersHorizontal, path: "/dashboard/models/settings" },
      { label: "Benchmark", icon: Gauge, path: "/dashboard/models/benchmark" },
    ],
  },
  {
    label: "Analytics",
    icon: BarChart3,
    items: [
      { label: "Metrics", icon: BarChart3, path: "/dashboard/metrics" },
      { label: "Export", icon: Download, path: "/dashboard/export" },
    ],
  },
  {
    label: "Agent",
    icon: Bot,
    items: [
      { label: "Agent Loop", icon: Bot, path: "/dashboard/agent" },
      { label: "Memory", icon: Brain, path: "/dashboard/memory" },
    ],
  },
  {
    label: "Operations",
    icon: FlaskConical,
    items: [
      { label: "MLOps", icon: FlaskConical, path: "/dashboard/mlops" },
      { label: "Governance", icon: Shield, path: "/dashboard/governance" },
    ],
  },
  {
    label: "Settings",
    icon: Settings,
    items: [
      { label: "Config", icon: FileCode, path: "/dashboard/settings" },
      { label: "API Keys", icon: Key, path: "/dashboard/settings/api-keys" },
      { label: "Credits", icon: Coins, path: "/dashboard/settings/credits" },
    ],
  },
];

/** Flat list for backward compat — re-derived from grouped items */
export const dashboardNavItems: DashboardNavItem[] = dashboardSidebarItems.flatMap(
  (item) => (isNavGroup(item) ? item.items : [item]),
);

/** Dashboard sidebar — fleet management section */
export const fleetNavItems: DashboardNavItem[] = [
  { label: "Fleet Overview", icon: Radio, path: "/dashboard/fleet" },
  { label: "Deployments", icon: Rocket, path: "/dashboard/fleet/deployments" },
  { label: "Device Groups", icon: Users, path: "/dashboard/fleet/groups" },
  { label: "Maintenance", icon: Wrench, path: "/dashboard/fleet/maintenance" },
  { label: "Alerts", icon: Bell, path: "/dashboard/fleet/alerts" },
];


