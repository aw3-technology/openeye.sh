import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Brain, Plus, Trash2 } from "lucide-react";

interface SystemPromptEntry {
  key: string;
  value: string;
}

interface SystemPromptsPanelProps {
  prompts: SystemPromptEntry[];
  onAddPrompt: (key: string) => void;
  onRemovePrompt: (idx: number) => void;
  onUpdatePromptValue: (idx: number, value: string) => void;
}

export function SystemPromptsPanel({
  prompts,
  onAddPrompt,
  onRemovePrompt,
  onUpdatePromptValue,
}: SystemPromptsPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-400" />
          <CardTitle className="text-base">System Prompts</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Named system prompts injected into VLM and cortex reasoning calls. Common keys: base, safety,
          governance, task.
        </p>

        {prompts.length === 0 && (
          <div className="rounded-lg border border-dashed py-6 text-center">
            <p className="text-sm text-muted-foreground">No system prompts configured.</p>
          </div>
        )}

        {prompts.map((prompt, idx) => (
          <div key={idx} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label className="font-mono text-xs">{prompt.key}</Label>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-red-400"
                onClick={() => onRemovePrompt(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Textarea
              value={prompt.value}
              onChange={(e) => onUpdatePromptValue(idx, e.target.value)}
              className="min-h-[80px] font-mono text-xs"
              placeholder={`Enter system prompt for "${prompt.key}"...`}
            />
          </div>
        ))}

        <Separator />

        <AddPromptInput onAdd={onAddPrompt} />
      </CardContent>
    </Card>
  );
}

function AddPromptInput({ onAdd }: { onAdd: (key: string) => void }) {
  const [newKey, setNewKey] = useState("");

  const handleAdd = () => {
    const key = newKey.trim();
    if (!key) return;
    onAdd(key);
    setNewKey("");
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={newKey}
        onChange={(e) => setNewKey(e.target.value)}
        placeholder="Prompt key (e.g. safety)"
        className="max-w-[200px] font-mono text-xs"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAdd();
        }}
      />
      <Button variant="outline" size="sm" onClick={handleAdd} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        Add Prompt
      </Button>
    </div>
  );
}
