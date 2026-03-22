import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateMaintenanceWindow } from "@/hooks/useFleetQueries";
import { toast } from "sonner";
import type { MaintenanceWindowResponse } from "@/types/fleet";
import { RECURRENCE_OPTIONS } from "./constants";

interface EditMaintenanceDialogProps {
  window: MaintenanceWindowResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditMaintenanceDialog({ window: editWindow, open, onOpenChange }: EditMaintenanceDialogProps) {
  const updateMutation = useUpdateMaintenanceWindow();

  const [editName, setEditName] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [editRecurrence, setEditRecurrence] = useState("");

  useEffect(() => {
    if (editWindow) {
      setEditName(editWindow.name);
      setEditStartsAt(editWindow.starts_at.slice(0, 16));
      setEditEndsAt(editWindow.ends_at.slice(0, 16));
      setEditRecurrence(editWindow.recurrence || "");
    }
  }, [editWindow]);

  const handleEdit = () => {
    if (!editWindow) return;
    updateMutation.mutate(
      {
        id: editWindow.id,
        req: {
          name: editName,
          starts_at: new Date(editStartsAt).toISOString(),
          ends_at: new Date(editEndsAt).toISOString(),
          recurrence: editRecurrence && editRecurrence !== "none" ? editRecurrence : null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Maintenance window updated");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Maintenance Window</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Starts At</Label>
              <Input
                type="datetime-local"
                value={editStartsAt}
                onChange={(e) => setEditStartsAt(e.target.value)}
              />
            </div>
            <div>
              <Label>Ends At</Label>
              <Input
                type="datetime-local"
                value={editEndsAt}
                onChange={(e) => setEditEndsAt(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Recurrence</Label>
            <Select value={editRecurrence || "none"} onValueChange={setEditRecurrence}>
              <SelectTrigger>
                <SelectValue placeholder="One-time" />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value || "none"} value={opt.value || "none"}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            disabled={!editName || !editStartsAt || !editEndsAt || updateMutation.isPending}
            onClick={handleEdit}
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
