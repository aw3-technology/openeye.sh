import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRegisterDevice } from "@/hooks/useFleetQueries";
import { Plus, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import type { DeviceType } from "@/types/fleet";


export function RegisterDeviceDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [deviceType, setDeviceType] = useState<DeviceType>("edge_node");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const registerMutation = useRegisterDevice();

  const handleRegister = () => {
    registerMutation.mutate({ name, device_type: deviceType }, {
      onSuccess: (result) => {
        if (result.api_key) setApiKey(result.api_key);
        toast.success("Device registered");
      },
    });
  };

  const handleCopy = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setName("");
    setDeviceType("edge_node");
    setApiKey(null);
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Register Device
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{apiKey ? "Device Registered" : "Register New Device"}</DialogTitle>
        </DialogHeader>

        {apiKey ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Save this API key now — it won't be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded border bg-muted p-2 text-xs break-all">{apiKey}</code>
              <Button size="icon" variant="outline" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button className="w-full" onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Device Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. warehouse-cam-01" />
            </div>
            <div>
              <Label>Device Type</Label>
              <Select value={deviceType} onValueChange={(v) => setDeviceType(v as DeviceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="camera">Camera</SelectItem>
                  <SelectItem value="robot">Robot</SelectItem>
                  <SelectItem value="edge_node">Edge Node</SelectItem>
                  <SelectItem value="gateway">Gateway</SelectItem>
                  <SelectItem value="drone">Drone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={!name.trim() || registerMutation.isPending}
              onClick={handleRegister}
            >
              {registerMutation.isPending ? "Registering..." : "Register"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
