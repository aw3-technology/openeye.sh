import { useState, useRef, useEffect } from "react";
import { usePredict, useSaveInference, useInferenceHistory } from "@/hooks/useOpenEyeQueries";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { useCreditBalance, useDeductCredits, useIssueCredits } from "@/hooks/useCredits";
import { INFERENCE_CREDIT_COST, getTotalBalance } from "@/types/credits";
import { isCredSystemConfigured } from "@/lib/deployment-env";
import { toast } from "sonner";
import type { PredictionResult } from "@/types/openeye";

export function useInference() {
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

  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  const runInference = (file: File) => {
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);

    const url = URL.createObjectURL(file);
    prevUrlRef.current = url;
    setImageUrl(url);
    setResult(null);
    setLastFile(file);

    if (isCloud) {
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
    setLastFile(file);
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

  return {
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
  };
}
