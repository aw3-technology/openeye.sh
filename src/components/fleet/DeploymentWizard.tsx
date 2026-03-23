import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateDeployment, useFleetDevices, useFleetGroups } from "@/hooks/useFleetQueries";
import { Rocket } from "lucide-react";
import { toast } from "sonner";
import type { DeploymentStrategy } from "@/types/fleet";

export function DeploymentWizard() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [modelId, setModelId] = useState("");
  const [modelVersion, setModelVersion] = useState("");
  const [modelUrl, setModelUrl] = useState("");
  const [strategy, setStrategy] = useState<DeploymentStrategy>("canary");
  const [targetGroupId, setTargetGroupId] = useState<string>("");

  const createMutation = useCreateDeployment();
  const { data: groups } = useFleetGroups();

  const handleCreate = () => {
    createMutation.mutate({
      name,
      model_id: modelId,
      model_version: modelVersion,
      model_url: modelUrl || undefined,
      strategy,
      target_group_id: targetGroupId || undefined,
    }, {
      onSuccess: () => {
        toast.success("Deployment created");
        setOpen(false);
        setName("");
        setModelId("");
        setModelVersion("");
        setModelUrl("");
        setStrategy("canary");
        setTargetGroupId("");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Rocket className="h-4 w-4 mr-1" /> New Deployment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Deployment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Deployment Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. yolov8-update-march" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Model ID</Label>
              <Input value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="yolov8n" />
            </div>
            <div>
              <Label>Model Version</Label>
              <Input value={modelVersion} onChange={(e) => setModelVersion(e.target.value)} placeholder="1.2.0" />
            </div>
          </div>
          <div>
            <Label>Model URL (optional)</Label>
            <Input value={modelUrl} onChange={(e) => setModelUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Strategy</Label>
              <Select value={strategy} onValueChange={(v) => setStrategy(v as DeploymentStrategy)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="canary">Canary</SelectItem>
                  <SelectItem value="rolling">Rolling</SelectItem>
                  <SelectItem value="blue_green">Blue/Green</SelectItem>
                  <SelectItem value="all_at_once">All at once</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target Group</Label>
              <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                <SelectContent>
                  {(groups || []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="w-full"
            disabled={!name || !modelId || !modelVersion || createMutation.isPending}
            onClick={handleCreate}
          >
            {createMutation.isPending ? "Creating..." : "Create Deployment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
