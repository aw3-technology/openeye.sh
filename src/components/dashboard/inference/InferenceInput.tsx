import { FileDropzone } from "@/components/dashboard/FileDropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scan } from "lucide-react";

interface InferenceInputProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onFile: (file: File) => void;
  disabled: boolean;
}

export function InferenceInput({ prompt, onPromptChange, onFile, disabled }: InferenceInputProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scan className="h-4 w-4 text-primary" />
          Run Prediction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="prompt" className="text-xs text-muted-foreground">
            Text Prompt (optional, for Grounding DINO)
          </Label>
          <Input
            id="prompt"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="e.g. person . car . dog"
            className="font-mono text-sm"
          />
        </div>

        <FileDropzone onFile={onFile} disabled={disabled} />
      </CardContent>
    </Card>
  );
}
