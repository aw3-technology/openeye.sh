import { useState, useRef, useEffect } from "react";
import { usePredict, useSaveInference, useInferenceHistory } from "@/hooks/useOpenEyeQueries";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { useCreditBalance, useDeductCredits, useIssueCredits } from "@/hooks/useCredits";
import { INFERENCE_CREDIT_COST, getTotalBalance } from "@/types/credits";
import { isCredSystemConfigured } from "@/lib/deployment-env";
import { FileDropzone } from "@/components/dashboard/FileDropzone";
import { DetectionCanvas } from "@/components/dashboard/DetectionCanvas";
import { InsufficientCreditsDialog } from "@/components/dashboard/InsufficientCreditsDialog";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DetectionList } from "@/components/dashboard/inference/DetectionList";
import { InferenceResultsSidebar } from "@/components/dashboard/inference/InferenceResultsSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Coins,
  Copy,
  Cpu,
  Eye,
  Hash,
  ImagePlus,
  Loader2,
  RotateCcw,
  Scan,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import type { PredictionResult } from "@/types/openeye";

export default function Inference() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [prompt, setPrompt] = useState("");
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const { serverUrl, isConnected, healthData, isCloudDeployment } = useOpenEyeConnection();
  const isCloud = isCloudDeployment && isCredSystemConfigured();
  const predict = usePredict();
  const saveInference = useSaveInference();
  const creditBalance = useCreditBalance();
  const deductCredits = useDeductCredits();
  const refundCredits = useIssueCredits();
  const { data: historyData } = useInferenceHistory(0, 1);
  const prevUrlRef = useRef<string | null>(null);

  const totalInferences = historyData?.count ?? 0;

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
    setLastFile(file);

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
      const balance = getTotalBalance(creditBalance.data);
      if (balance < INFERENCE_CREDIT_COST) {
        setShowCreditsDialog(true);
        return;
      }
    }
    runInference(file);
  };

  const handleRerun = () => {
    if (lastFile) handleFile(lastFile);
  };

  const handleCopyJson = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    toast.success("Copied result JSON to clipboard");
  };

  const isLoading = predict.isPending || deductCredits.isPending;

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Image Inference</h1>
          {isConnected ? (
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-terminal-green/30 text-terminal-green"
            >
              READY
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-red-500/30 text-red-400"
            >
              OFFLINE
            </Badge>
          )}
        </div>
        {result && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopyJson}>
              <Copy className="h-3 w-3" />
              Copy JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleRerun}
              disabled={isLoading || !lastFile}
            >
              <RotateCcw className="h-3 w-3" />
              Re-run
            </Button>
          </div>
        )}
      </div>

      {/* ---- Metric Cards ---- */}
      <div className={`grid gap-4 sm:grid-cols-2 ${isCloud ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <MetricCard
          label="Server"
          value={isConnected ? "Connected" : "Offline"}
          icon={isConnected ? Wifi : WifiOff}
          color={isConnected ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}
          description={serverUrl}
        />
        <MetricCard
          label="Active Model"
          value={healthData?.model || (isConnected ? "—" : "N/A")}
          icon={Cpu}
          color="bg-blue-500/15 text-blue-500"
        />
        <MetricCard
          label="Total Inferences"
          value={totalInferences}
          icon={Hash}
          color="bg-purple-500/15 text-purple-500"
        />
        {isCloud && (
          <MetricCard
            label="Credits"
            value={creditBalance.data ? getTotalBalance(creditBalance.data) : "—"}
            icon={Coins}
            color="bg-yellow-500/15 text-yellow-500"
          />
        )}
      </div>

      {/* ---- Prompt + Upload ---- */}
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
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. person . car . dog"
              className="font-mono text-sm"
            />
          </div>

          <FileDropzone onFile={handleFile} disabled={isLoading} />
        </CardContent>
      </Card>

      <InsufficientCreditsDialog
        open={showCreditsDialog}
        onOpenChange={setShowCreditsDialog}
        balance={getTotalBalance(creditBalance.data)}
      />

      {/* ---- Loading State ---- */}
      {isLoading && (
        <Card className="border-foreground/10 bg-card/50">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium">
                {deductCredits.isPending ? "Reserving credits..." : "Running inference..."}
              </p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {healthData?.model || "model"} &middot; {prompt || "no prompt"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Error State ---- */}
      {predict.isError && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-red-500/10 p-2">
              <Eye className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-400">Inference Failed</p>
              <p className="text-xs text-muted-foreground">
                {predict.error instanceof Error ? predict.error.message : "Unknown error occurred"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Results ---- */}
      {result && imageUrl && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Detection Canvas */}
          <div className="lg:col-span-2 space-y-4">
            <DetectionCanvas objects={result.objects} imageUrl={imageUrl} />
            <DetectionList objects={result.objects} />
          </div>

          {/* Sidebar */}
          <InferenceResultsSidebar result={result} />
        </div>
      )}

      {/* ---- Empty State (no result, not loading) ---- */}
      {!result && !isLoading && !predict.isError && (
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
                  ? `${healthData?.model || "model"} ready`
                  : "Connect to a server first"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
