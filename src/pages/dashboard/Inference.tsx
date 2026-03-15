import { useState, useRef, useEffect } from "react";
import { usePredict, useSaveInference, useInferenceHistory } from "@/hooks/useOpenEyeQueries";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { useCreditBalance, useDeductCredits, useRefundCredits } from "@/hooks/useCredits";
import { INFERENCE_CREDIT_COST } from "@/types/credits";
import { isCloudUrl } from "@/lib/openeye-client";
import { FileDropzone } from "@/components/dashboard/FileDropzone";
import { DetectionCanvas } from "@/components/dashboard/DetectionCanvas";
import { InsufficientCreditsDialog } from "@/components/dashboard/InsufficientCreditsDialog";
import { MetricCard } from "@/components/dashboard/MetricCard";
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
  Gauge,
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

function latencyColor(ms: number) {
  if (ms < 50) return "text-terminal-green";
  if (ms < 150) return "text-terminal-amber";
  return "text-red-400";
}

export default function Inference() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [prompt, setPrompt] = useState("");
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const { serverUrl, isConnected, healthData } = useOpenEyeConnection();
  const isCloud = isCloudUrl(serverUrl);
  const predict = usePredict();
  const saveInference = useSaveInference();
  const creditBalance = useCreditBalance();
  const deductCredits = useDeductCredits();
  const refundCredits = useRefundCredits();
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
      const balance = creditBalance.data?.balance ?? 0;
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
            value={creditBalance.data?.balance ?? "—"}
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
        balance={creditBalance.data?.balance ?? 0}
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

            {/* Detection List */}
            <Card className="border-foreground/10 bg-card/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-terminal-green" />
                    <CardTitle className="text-sm">Detections</CardTitle>
                  </div>
                  {result.objects.length > 0 && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {result.objects.length} detected
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {result.objects.length === 0 ? (
                  <p className="text-sm text-muted-foreground font-mono py-4 text-center">
                    No objects detected.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                    {result.objects.map((obj, i) => {
                      const isPerson = obj.label.toLowerCase() === "person";
                      const isHazard =
                        obj.label.toLowerCase().includes("knife") || obj.confidence < 0.5;
                      const confidence = obj.confidence * 100;

                      return (
                        <div
                          key={`${obj.label}-${i}`}
                          className={`flex items-center justify-between font-mono text-xs py-1.5 px-2 rounded-md ${
                            isHazard
                              ? "bg-terminal-amber/5 border border-terminal-amber/10"
                              : isPerson
                                ? "bg-purple-500/5 border border-purple-500/10"
                                : "bg-foreground/5 border border-foreground/5"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isHazard
                                  ? "bg-terminal-amber"
                                  : isPerson
                                    ? "bg-purple-400"
                                    : "bg-terminal-green"
                              }`}
                            />
                            <span
                              className={
                                isHazard
                                  ? "text-terminal-amber"
                                  : isPerson
                                    ? "text-purple-400"
                                    : ""
                              }
                            >
                              {obj.label}
                            </span>
                            {isHazard && (
                              <span className="text-[9px] bg-terminal-amber/20 text-terminal-amber px-1 py-0.5 rounded uppercase">
                                hazard
                              </span>
                            )}
                            {isPerson && (
                              <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded">
                                PERSON
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  confidence > 80
                                    ? "bg-terminal-green"
                                    : confidence > 50
                                      ? "bg-terminal-amber"
                                      : "bg-red-400"
                                }`}
                                style={{ width: `${confidence}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-muted-foreground w-12 text-right">
                              {confidence.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Summary Card */}
            <Card className="border-foreground/10 bg-card/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Cpu className="h-3.5 w-3.5 text-blue-400" />
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-mono">{result.model}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Task</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {result.task}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Objects</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {result.objects.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Inference</span>
                  <span className={`font-mono tabular-nums font-semibold ${latencyColor(result.inference_ms)}`}>
                    {result.inference_ms.toFixed(1)}ms
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Resolution</span>
                  <span className="font-mono tabular-nums">
                    {result.image.width}&times;{result.image.height}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Timestamp</span>
                  <span className="font-mono tabular-nums text-[10px]">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Object Distribution */}
            {result.objects.length > 0 && <ObjectDistribution objects={result.objects} />}

            {/* Bounding Box Details */}
            {result.objects.length > 0 && (
              <Card className="border-foreground/10 bg-card/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
                    Bounding Boxes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                    {result.objects.map((obj, i) => (
                      <div
                        key={`bbox-${obj.label}-${i}`}
                        className="flex items-center justify-between font-mono text-[10px] py-1 px-2 rounded bg-foreground/5"
                      >
                        <span className="text-muted-foreground truncate max-w-[80px]">
                          {obj.label}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          [{obj.bbox.x.toFixed(2)}, {obj.bbox.y.toFixed(2)}, {obj.bbox.w.toFixed(2)},{" "}
                          {obj.bbox.h.toFixed(2)}]
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
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

/* ─── Object Distribution ────────────────────────────────────────── */

function ObjectDistribution({ objects }: { objects: PredictionResult["objects"] }) {
  const labelCounts: Record<string, { count: number; avgConf: number }> = {};
  objects.forEach((o) => {
    if (!labelCounts[o.label]) labelCounts[o.label] = { count: 0, avgConf: 0 };
    labelCounts[o.label].count += 1;
    labelCounts[o.label].avgConf += o.confidence;
  });
  Object.values(labelCounts).forEach((v) => {
    v.avgConf /= v.count;
  });
  const sorted = Object.entries(labelCounts).sort((a, b) => b[1].count - a[1].count);

  return (
    <Card className="border-foreground/10 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Gauge className="h-3.5 w-3.5 text-green-400" />
          Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sorted.map(([label, { count, avgConf }]) => {
            const pct = Math.round((count / objects.length) * 100);
            return (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="truncate max-w-[120px]">{label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {count} &middot; {(avgConf * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/70 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
