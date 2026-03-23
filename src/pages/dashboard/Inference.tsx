import { useInference } from "@/hooks/useInference";
import { getTotalBalance } from "@/types/credits";
import { DetectionCanvas } from "@/components/dashboard/DetectionCanvas";
import { InsufficientCreditsDialog } from "@/components/dashboard/InsufficientCreditsDialog";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DetectionList } from "@/components/dashboard/inference/DetectionList";
import { InferenceResultsSidebar } from "@/components/dashboard/inference/InferenceResultsSidebar";
import { InferenceInput } from "@/components/dashboard/inference/InferenceInput";
import { InferenceLoading, InferenceError, InferenceEmpty } from "@/components/dashboard/inference/InferenceStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Coins,
  Copy,
  Cpu,
  Hash,
  RotateCcw,
  Wifi,
  WifiOff,
} from "lucide-react";

export default function Inference() {
  const {
    imageUrl,
    result,
    prompt,
    setPrompt,
    showCreditsDialog,
    setShowCreditsDialog,
    lastFile,
    serverUrl,
    isConnected,
    healthData,
    isCloud,
    predict,
    creditBalance,
    deductCredits,
    totalInferences,
    isLoading,
    handleFile,
    handleRerun,
    handleCopyJson,
  } = useInference();

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
      <InferenceInput
        prompt={prompt}
        onPromptChange={setPrompt}
        onFile={handleFile}
        disabled={isLoading}
      />

      <InsufficientCreditsDialog
        open={showCreditsDialog}
        onOpenChange={setShowCreditsDialog}
        balance={getTotalBalance(creditBalance.data)}
      />

      {/* ---- Loading State ---- */}
      {isLoading && (
        <InferenceLoading
          isDeducting={deductCredits.isPending}
          model={healthData?.model}
          prompt={prompt}
        />
      )}

      {/* ---- Error State ---- */}
      {predict.isError && (
        <InferenceError error={predict.error} />
      )}

      {/* ---- Results ---- */}
      {result && imageUrl && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <DetectionCanvas objects={result.objects} imageUrl={imageUrl} />
            <DetectionList objects={result.objects} />
          </div>
          <InferenceResultsSidebar result={result} />
        </div>
      )}

      {/* ---- Empty State (no result, not loading) ---- */}
      {!result && !isLoading && !predict.isError && (
        <InferenceEmpty isConnected={isConnected} model={healthData?.model} />
      )}
    </div>
  );
}
