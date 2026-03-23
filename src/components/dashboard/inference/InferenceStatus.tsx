import { Card, CardContent } from "@/components/ui/card";
import { Eye, ImagePlus, Loader2 } from "lucide-react";

interface InferenceLoadingProps {
  isDeducting: boolean;
  model: string | undefined;
  prompt: string;
}

export function InferenceLoading({ isDeducting, model, prompt }: InferenceLoadingProps) {
  return (
    <Card className="border-foreground/10 bg-card/50">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-sm font-medium">
            {isDeducting ? "Reserving credits..." : "Running inference..."}
          </p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            {model || "model"} &middot; {prompt || "no prompt"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface InferenceErrorProps {
  error: unknown;
}

export function InferenceError({ error }: InferenceErrorProps) {
  return (
    <Card className="border-red-500/20 bg-red-500/5">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-red-500/10 p-2">
          <Eye className="h-4 w-4 text-red-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-red-400">Inference Failed</p>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error occurred"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface InferenceEmptyProps {
  isConnected: boolean;
  model: string | undefined;
}

export function InferenceEmpty({ isConnected, model }: InferenceEmptyProps) {
  return (
    <Card className="border-foreground/10 bg-card/50">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
        <div className="rounded-full bg-muted p-4">
          <ImagePlus className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Upload an image to run inference</p>
          <p className="text-xs text-muted-foreground mt-1">
            Drop an image above or click to browse &middot;{" "}
            {isConnected
              ? `${model || "model"} ready`
              : "Connect to a server first"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
