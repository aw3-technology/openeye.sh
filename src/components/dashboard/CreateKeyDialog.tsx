import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Copy } from "lucide-react";
import { toast } from "sonner";

interface CreateKeyDialogProps {
  onGenerate: (name: string) => Promise<string>;
}

export function CreateKeyDialog({ onGenerate }: CreateKeyDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const rawKey = await onGenerate(name.trim());
      setCreatedKey(rawKey);
      setName("");
    } catch {
      toast.error("Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setCreatedKey(null);
    setName("");
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Create Key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {createdKey ? "Key Created" : "Create API Key"}
          </DialogTitle>
          <DialogDescription>
            {createdKey
              ? "Copy your key now. It won't be shown again."
              : "Give your key a descriptive name."}
          </DialogDescription>
        </DialogHeader>

        {createdKey ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
                {createdKey}
              </code>
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy API key to clipboard"
                onClick={() => {
                  navigator.clipboard.writeText(createdKey).then(
                    () => toast.success("Copied to clipboard"),
                    () => toast.error("Failed to copy to clipboard"),
                  );
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="key-name">Key Name</Label>
            <Input
              id="key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production Server"
            />
          </div>
        )}

        <DialogFooter>
          {createdKey ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <Button onClick={handleCreate} disabled={!name.trim() || creating}>
              {creating ? "Generating..." : "Generate"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
