import { useState, useRef, useEffect } from "react";
import { usePredict, useSaveInference } from "@/hooks/useOpenEyeQueries";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { useCreditBalance, useDeductCredits, useRefundCredits } from "@/hooks/useCredits";
import { INFERENCE_CREDIT_COST } from "@/types/credits";
import { isCloudUrl } from "@/lib/openeye-client";
import { FileDropzone } from "@/components/dashboard/FileDropzone";
import { DetectionCanvas } from "@/components/dashboard/DetectionCanvas";
import { InsufficientCreditsDialog } from "@/components/dashboard/InsufficientCreditsDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toastMutationError } from "@/lib/utils";
import type { PredictionResult } from "@/types/openeye";

export default function Inference() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [prompt, setPrompt] = useState("");
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);
  const { serverUrl } = useOpenEyeConnection();
  const isCloud = isCloudUrl(serverUrl);
  const predict = usePredict();
  const saveInference = useSaveInference();
  const creditBalance = useCreditBalance();
  const deductCredits = useDeductCredits();
  const refundCredits = useRefundCredits();
  const prevUrlRef = useRef<string | null>(null);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  const runInference = (file: File) => {
    // Revoke previous blob URL to prevent memory leak
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);

    const url = URL.createObjectURL(file);
    prevUrlRef.current = url;
    setImageUrl(url);
    setResult(null);

    if (isCloud) {
      // Deduct first, then run inference. Refund on inference failure.
      deductCredits.mutate(
        { amount: INFERENCE_CREDIT_COST, description: "Inference (pending)" },
        {
          onSuccess: () => {
            predict.mutate(
              { file, prompt: prompt || undefined },
              {
                onSuccess: (data) => {
                  setResult(data);
                  saveInference.mutate({
                    model: data.model,
                    task: data.task,
                    timestamp: data.timestamp,
                    image_width: data.image.width,
                    image_height: data.image.height,
                    image_source: data.image.source,
                    object_count: data.objects.length,
                    objects_json: JSON.stringify(data.objects),
                    inference_ms: data.inference_ms,
                  });
                },
                onError: () => {
                  // Inference failed — actually refund the deducted credit
                  refundCredits.mutate(
                    { amount: INFERENCE_CREDIT_COST, description: "Inference failure refund" },
                    {
                      onSuccess: () => toast.error("Inference failed — credit has been refunded."),
                      onError: () => toast.error("Inference failed — credit refund also failed. Please contact support."),
                    },
                  );
                },
              },
            );
          },
          onError: () => {
            toast.error("Failed to deduct credits. Please try again.");
          },
        },
      );
    } else {
      // Local mode — no credits needed
      predict.mutate(
        { file, prompt: prompt || undefined },
        {
          onSuccess: (data) => {
            setResult(data);
            saveInference.mutate({
              model: data.model,
              task: data.task,
              timestamp: data.timestamp,
              image_width: data.image.width,
              image_height: data.image.height,
              image_source: data.image.source,
              object_count: data.objects.length,
              objects_json: JSON.stringify(data.objects),
              inference_ms: data.inference_ms,
            });
          },
        },
      );
    }
  };

  const handleFile = (file: File) => {
    if (isCloud) {
      const balance = creditBalance.data?.balance ?? 0;
      if (balance < INFERENCE_CREDIT_COST) {
        setShowCreditsDialog(true);
        return;
      }
    }
    runInference(file);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Image Inference</h1>

      <div className="space-y-2">
        <Label htmlFor="prompt">Text Prompt (optional, for Grounding DINO)</Label>
        <Input
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. person . car . dog"
        />
      </div>

      <FileDropzone onFile={handleFile} disabled={predict.isPending || deductCredits.isPending} />

      <InsufficientCreditsDialog
        open={showCreditsDialog}
        onOpenChange={setShowCreditsDialog}
        balance={creditBalance.data?.balance ?? 0}
      />

      {(predict.isPending || deductCredits.isPending) && (
        <div className="flex items-center justify-center gap-2 py-8" role="status">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">
            {deductCredits.isPending ? "Reserving credits..." : "Running inference..."}
          </span>
        </div>
      )}

      {predict.isError && (
        <p className="text-sm text-destructive" role="alert">
          Error: {predict.error instanceof Error ? predict.error.message : "Inference failed"}
        </p>
      )}

      {result && imageUrl && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DetectionCanvas objects={result.objects} imageUrl={imageUrl} />
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Model:</span> {result.model}
                </p>
                <p>
                  <span className="text-muted-foreground">Task:</span> {result.task}
                </p>
                <p>
                  <span className="text-muted-foreground">Objects:</span> {result.objects.length}
                </p>
                <p>
                  <span className="text-muted-foreground">Inference:</span>{" "}
                  <span className="tabular-nums">{result.inference_ms.toFixed(1)}ms</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Resolution:</span>{" "}
                  <span className="tabular-nums">
                    {result.image.width}×{result.image.height}
                  </span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Detected Objects</CardTitle>
              </CardHeader>
              <CardContent>
                {result.objects.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No objects detected.</p>
                ) : (
                  <div className="space-y-1.5">
                    {result.objects.map((obj, i) => (
                      <div
                        key={`${obj.label}-${i}`}
                        className="flex items-center justify-between text-xs font-mono"
                      >
                        <span>{obj.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {(obj.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
