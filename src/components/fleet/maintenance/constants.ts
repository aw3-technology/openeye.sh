import type { MaintenanceWindowResponse } from "@/types/fleet";

export type WindowStatus = "active" | "upcoming" | "expired";
export type FilterTab = "all" | WindowStatus;

export const RECURRENCE_OPTIONS = [
  { value: "", label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

export function getWindowStatus(w: MaintenanceWindowResponse): WindowStatus {
  const now = Date.now();
  const start = new Date(w.starts_at).getTime();
  const end = new Date(w.ends_at).getTime();
  if (now >= start && now <= end) return "active";
  if (now < start) return "upcoming";
  return "expired";
}

export const statusConfig: Record<
  WindowStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  upcoming: {
    label: "Upcoming",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  expired: {
    label: "Expired",
    className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  },
};
