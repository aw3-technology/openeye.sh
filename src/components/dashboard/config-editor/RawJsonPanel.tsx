import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, FileCode } from "lucide-react";

interface RawJsonPanelProps {
  rawText: string;
  onRawTextChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}

export function RawJsonPanel({ rawText, onRawTextChange, onSave, saving }: RawJsonPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Raw Configuration</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Edit the full configuration JSON directly. Supports arbitrary keys beyond the form fields.
        </p>
        <Textarea
          value={rawText}
          onChange={(e) => onRawTextChange(e.target.value)}
          className="min-h-[400px] font-mono text-xs"
        />
        <Button onClick={onSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
