import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeviceStatusBadge } from "./DeviceStatusBadge";
import type { DeviceResponse } from "@/types/fleet";

interface DeviceTableProps {
  devices: DeviceResponse[];
}

export function DeviceTable({ devices }: DeviceTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => devices.filter((d) => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) || d.id.includes(search);
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [devices, search, statusFilter]);

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Input
          placeholder="Search devices..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Last Heartbeat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No devices found
                </TableCell>
              </TableRow>
            )}
            {filtered.map((device) => (
              <TableRow key={device.id}>
                <TableCell>
                  <Link to={`/dashboard/fleet/devices/${device.id}`} className="font-medium hover:underline text-primary">
                    {device.name}
                  </Link>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{device.device_type}</TableCell>
                <TableCell>
                  <DeviceStatusBadge status={device.status} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {device.current_model_version || "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {device.last_heartbeat_at
                    ? new Date(device.last_heartbeat_at).toLocaleString()
                    : "Never"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
