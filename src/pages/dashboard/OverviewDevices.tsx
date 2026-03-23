import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MonitorSmartphone } from "lucide-react";
import type { DeviceRow } from "@/types/openeye";

interface OverviewDevicesProps {
  devices: DeviceRow[];
}

export function OverviewDevices({ devices }: OverviewDevicesProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Registered Devices</CardTitle>
        {devices.length > 0 && (
          <Badge variant="secondary" className="tabular-nums">
            {devices.length}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {devices.length === 0 ? (
          <div className="py-6 text-center">
            <MonitorSmartphone className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              No devices registered yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Devices will appear here when they connect to your server.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <MonitorSmartphone className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{device.name}</p>
                    <p className="text-xs text-muted-foreground">{device.device_type}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate ml-2 shrink-0 max-w-[200px]">
                  {device.server_url}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
