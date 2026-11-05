import { useState, useRef, useEffect } from "react";
import { usePredict, useSaveInference, useInferenceHistory } from "@/hooks/useOpenEyeQueries";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { toast } from "sonner";
import type { PredictionResult } from "@/types/openeye";

export function useInference() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [prompt, setPrompt] = useState("");
  const [lastFile, setLastFile] = useState<File | null>(null);
  // Inference runs on the user's own `openeye serve`, which is free; credits
  // are only charged by the hosted API (api/v1.ts), server-side.
  const { serverUrl, isConnected, healthData } = useOpenEyeConnection();
  const predict = usePredict();
  const saveInference = useSaveInference();
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
  };

  const handleFile = (file: File) => {
    setLastFile(file);
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

  const isLoading = predict.isPending;

  return {
    imageUrl,
    result,
    prompt,
    setPrompt,
    lastFile,
    serverUrl,
    isConnected,
    healthData,
    predict,
    totalInferences,
    isLoading,
    handleFile,
    handleRerun,
    handleCopyJson,
  };
}
