import { useState, useMemo } from "react";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";

export function ServerUrlDialog() {
  const { serverUrl, setServerUrl, isCloudDeployment } = useOpenEyeConnection();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(serverUrl);
  const placeholder = useMemo(
    () => isCloudDeployment ? "https://your-server.example.com" : "http://localhost:8000",
    [isCloudDeployment],
  );

  const isValidUrl = (s: string) => {
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleSave = () => {
    const trimmed = url.replace(/\/+$/, "");
    if (!isValidUrl(trimmed)) {
      return;
    }
    setServerUrl(trimmed);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-3.5 w-3.5" />
          Server
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>OpenEye Server URL</DialogTitle>
          <DialogDescription>
            {isCloudDeployment
              ? "Enter the public URL of your OpenEye server to connect from the cloud dashboard."
              : "Enter the URL of your running \u0060openeye serve\u0060 instance."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="server-url">Server URL</Label>
          <Input
            id="server-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={placeholder}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValidUrl(url.replace(/\/+$/, ""))}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
