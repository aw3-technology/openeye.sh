import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceStatusBadge } from "@/components/fleet/DeviceStatusBadge";
import { ResourceChart } from "@/components/fleet/ResourceChart";
import { TagEditor } from "@/components/fleet/TagEditor";
import {
  useFleetDevice,
  useDeviceResourceHistory,
  useSetDeviceTags,
  useSetDeviceConfig,
  useRestartDevice,
  useDecommissionDevice,
} from "@/hooks/useFleetQueries";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, RotateCcw, Power } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { LoadingState, EmptyState } from "@/components/ui/data-states";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function DeviceDetail() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const { data: device, isLoading } = useFleetDevice(deviceId ?? "");
  const { data: resourceHistory } = useDeviceResourceHistory(deviceId ?? "");

  if (!deviceId) return <EmptyState message="Invalid device URL — no device ID provided." className="p-8" />;
  const setTagsMutation = useSetDeviceTags();
  const setConfigMutation = useSetDeviceConfig();
  const restartMutation = useRestartDevice();
  const decommissionMutation = useDecommissionDevice();

  const [configJson, setConfigJson] = useState("");
  const [configError, setConfigError] = useState("");
  const [decommissionOpen, setDecommissionOpen] = useState(false);
  const [decommissionReason, setDecommissionReason] = useState("");
  const [decommissionWipe, setDecommissionWipe] = useState(false);

  if (isLoading) return <LoadingState className="p-8" />;
  if (!device) return <EmptyState message="Device not found" className="p-8" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/fleet")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{device.name}</h1>
          <p className="text-sm text-muted-foreground">{device.device_type} &middot; {device.id}</p>
        </div>
        <DeviceStatusBadge status={device.status} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => restartMutation.mutate(device.id, {
            onSuccess: () => toast.success("Restart command queued"),
          })}
          disabled={restartMutation.isPending}
        >
          <RotateCcw className="h-4 w-4 mr-1" /> Restart
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDecommissionOpen(true)}
          disabled={decommissionMutation.isPending}
        >
          <Power className="h-4 w-4 mr-1" /> Decommission
        </Button>
        <Dialog open={decommissionOpen} onOpenChange={setDecommissionOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Decommission &ldquo;{device.name}&rdquo;</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will permanently decommission the device. This action cannot be undone.
            </p>
            <div className="space-y-3 py-2">
              <div>
                <Label>Reason</Label>
                <Input
                  value={decommissionReason}
                  onChange={(e) => setDecommissionReason(e.target.value)}
                  placeholder="e.g. End of life, replaced by new unit"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="wipe"
                  checked={decommissionWipe}
                  onCheckedChange={(v) => setDecommissionWipe(v === true)}
                />
                <Label htmlFor="wipe" className="text-sm font-normal">Wipe device data after decommissioning</Label>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setDecommissionOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={decommissionMutation.isPending}
                onClick={() => {
                  decommissionMutation.mutate(
                    { deviceId: device.id, reason: decommissionReason, wipeData: decommissionWipe },
                    {
                      onSuccess: () => {
                        toast.success("Device decommissioned");
                        setDecommissionOpen(false);
                        navigate("/dashboard/fleet");
                      },
                    }
                  );
                }}
              >
                {decommissionMutation.isPending ? "Decommissioning..." : "Confirm Decommission"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Firmware</p>
                <p className="text-sm font-medium">{device.firmware_version || "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Model Version</p>
                <p className="text-sm font-medium">{device.current_model_version || "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">IP Address</p>
                <p className="text-sm font-medium tabular-nums">{device.ip_address || "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Last Heartbeat</p>
                <p className="text-sm font-medium">
                  {device.last_heartbeat_at ? new Date(device.last_heartbeat_at).toLocaleString() : "Never"}
                </p>
              </CardContent>
            </Card>
          </div>

          {device.hardware_specs && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Hardware</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-muted-foreground">CPU:</span> {device.hardware_specs.cpu || "—"}</div>
                <div><span className="text-muted-foreground">Cores:</span> {device.hardware_specs.cpu_cores}</div>
                <div><span className="text-muted-foreground">RAM:</span> {device.hardware_specs.ram_gb} GB</div>
                <div><span className="text-muted-foreground">GPU:</span> {device.hardware_specs.gpu || "—"}</div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          {resourceHistory && resourceHistory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card><CardContent className="pt-4"><ResourceChart data={resourceHistory} metric="cpu_percent" label="CPU Usage" color="#14b8a6" /></CardContent></Card>
              <Card><CardContent className="pt-4"><ResourceChart data={resourceHistory} metric="memory_percent" label="Memory Usage" color="#8b5cf6" /></CardContent></Card>
              <Card><CardContent className="pt-4"><ResourceChart data={resourceHistory} metric="disk_percent" label="Disk Usage" color="#f59e0b" /></CardContent></Card>
              <Card><CardContent className="pt-4"><ResourceChart data={resourceHistory} metric="gpu_percent" label="GPU Usage" color="#ef4444" /></CardContent></Card>
            </div>
          ) : (
            <EmptyState message="No resource data yet" className="py-8 text-center" />
          )}
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Config Overrides</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                {JSON.stringify(device.config_overrides, null, 2)}
              </pre>
              <div>
                <Label>Update Config (JSON)</Label>
                <Input
                  value={configJson}
                  onChange={(e) => setConfigJson(e.target.value)}
                  placeholder='{"confidence_threshold": 0.5}'
                />
              </div>
              {configError && <p className="text-xs text-red-400">{configError}</p>}
              <Button
                size="sm"
                disabled={!configJson.trim() || setConfigMutation.isPending}
                onClick={() => {
                  try {
                    const parsed = JSON.parse(configJson);
                    setConfigError("");
                    setConfigMutation.mutate({ deviceId: device.id, config: parsed }, {
                      onSuccess: () => { toast.success("Config updated"); setConfigJson(""); },
                    });
                  } catch {
                    setConfigError("Invalid JSON. Please check your input.");
                  }
                }}
              >
                Save Config
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags">
          <Card>
            <CardHeader><CardTitle className="text-sm">Device Tags</CardTitle></CardHeader>
            <CardContent>
              <TagEditor
                tags={device.tags || {}}
                onChange={(tags) => setTagsMutation.mutate({ deviceId: device.id, tags })}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
