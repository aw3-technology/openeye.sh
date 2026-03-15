import type { DeviceStatus } from "@/types/fleet";

const statusConfig: Record<DeviceStatus, { label: string; className: string }> = {
  online: { label: "Online", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  offline: { label: "Offline", className: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
  pending: { label: "Pending", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  maintenance: { label: "Maintenance", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  error: { label: "Error", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  decommissioned: { label: "Decommissioned", className: "bg-gray-500/15 text-gray-500 border-gray-500/30" },
};

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const config = statusConfig[status] || statusConfig.offline;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${config.className}`}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${status === "online" ? "bg-green-400 animate-pulse" : status === "error" ? "bg-red-400" : "bg-current opacity-50"}`} />
      {config.label}
    </span>
  );
}
