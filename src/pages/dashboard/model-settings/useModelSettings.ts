import { useState, useEffect, useCallback } from "react";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { toast } from "sonner";
import type { ModelParameters } from "@/types/openeye";
import type { InferenceParams, VlmParams, StreamParams } from "./types";
import {
  DEFAULT_DETECTION,
  DEFAULT_INFERENCE,
  DEFAULT_VLM,
  DEFAULT_STREAM,
  STORAGE_KEY,
  INFERENCE_KEY,
  VLM_KEY,
  STREAM_KEY,
  DETECTION_MODELS,
  loadJson,
} from "./types";

export function useModelSettings() {
  const { isConnected, healthData } = useOpenEyeConnection();

  const [detection, setDetection] = useState<ModelParameters>(() =>
    loadJson(STORAGE_KEY, DEFAULT_DETECTION),
  );
  const [activeDetector, setActiveDetector] = useState("yolov8s");
  const [inference, setInference] = useState<InferenceParams>(() =>
    loadJson(INFERENCE_KEY, DEFAULT_INFERENCE),
  );
  const [vlm, setVlm] = useState<VlmParams>(() => loadJson(VLM_KEY, DEFAULT_VLM));
  const [stream, setStream] = useState<StreamParams>(() =>
    loadJson(STREAM_KEY, DEFAULT_STREAM),
  );
  const [classFilterText, setClassFilterText] = useState(
    detection.class_filter.join(", "),
  );

  useEffect(() => {
    if (healthData?.model) {
      const normalized = healthData.model.toLowerCase().replace(/[^a-z0-9]/g, "");
      const match = DETECTION_MODELS.find((m) =>
        normalized.includes(m.id.replace(/-/g, "")),
      );
      if (match) setActiveDetector(match.id);
    }
  }, [healthData]);

  const updateDetection = useCallback(
    (patch: Partial<ModelParameters>) =>
      setDetection((prev) => ({ ...prev, ...patch })),
    [],
  );

  const handleSaveAll = () => {
    const classFilter = classFilterText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const detectionFinal = { ...detection, class_filter: classFilter };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(detectionFinal));
    localStorage.setItem(INFERENCE_KEY, JSON.stringify(inference));
    localStorage.setItem(VLM_KEY, JSON.stringify(vlm));
    localStorage.setItem(STREAM_KEY, JSON.stringify(stream));
    toast.success("All settings saved");
  };

  const handleReset = () => {
    setDetection(DEFAULT_DETECTION);
    setClassFilterText("");
    setInference(DEFAULT_INFERENCE);
    setVlm(DEFAULT_VLM);
    setStream(DEFAULT_STREAM);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(INFERENCE_KEY);
    localStorage.removeItem(VLM_KEY);
    localStorage.removeItem(STREAM_KEY);
    toast.success("Settings reset to defaults");
  };

  return {
    isConnected,
    healthData,
    detection,
    updateDetection,
    activeDetector,
    setActiveDetector,
    inference,
    setInference,
    vlm,
    setVlm,
    stream,
    setStream,
    classFilterText,
    setClassFilterText,
    handleSaveAll,
    handleReset,
  };
}
