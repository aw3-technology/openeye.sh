/**
 * Shared fleet UI constants — badge styles, strategy config, severity config.
 * Eliminates duplication across Deployments, DeploymentDetail, FleetDashboard, and FleetAlerts.
 */

import {
  Layers,
  ArrowRightLeft,
  Copy,
  Zap,
  Info,
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
} from "lucide-react";
import type { DeploymentStrategy, AlertSeverity } from "@/types/fleet";

/** Tailwind classes for deployment status badges. */
export const deploymentStatusBadge: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  in_progress: "bg-teal-500/15 text-teal-400 border-teal-500/30",
  paused: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  rolling_back: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  rolled_back: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

/** Lucide icon component for each deployment strategy. */
export const strategyIcon: Record<DeploymentStrategy, typeof Layers> = {
  canary: Layers,
  rolling: ArrowRightLeft,
  blue_green: Copy,
  all_at_once: Zap,
};

/** Human-readable label for each deployment strategy. */
export const strategyLabel: Record<DeploymentStrategy, string> = {
  canary: "Canary",
  rolling: "Rolling",
  blue_green: "Blue/Green",
  all_at_once: "All at Once",
};

/** Tailwind classes for alert severity badges. */
export const severityBadge: Record<AlertSeverity, string> = {
  info: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  error: "bg-red-500/15 text-red-400 border-red-500/30",
  critical: "bg-red-600/20 text-red-300 border-red-600/40",
};

/** Lucide icon component for each alert severity level. */
export const severityIcon: Record<AlertSeverity, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertOctagon,
  critical: ShieldAlert,
};
