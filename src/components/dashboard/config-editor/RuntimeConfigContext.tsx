import { createContext, useContext, type ReactNode } from "react";
import type { ModelOption } from "@/data/modelOptions";

export interface RuntimeConfigValues {
  modes: string;
  onModesChange: (v: string) => void;
  vlmModel: string;
  onVlmModelChange: (v: string) => void;
  cortexLlm: string;
  onCortexLlmChange: (v: string) => void;
  hertz: number;
  onHertzChange: (v: number) => void;
  confidenceThreshold: number;
  onConfidenceThresholdChange: (v: number) => void;
  dangerM: number;
  onDangerMChange: (v: number) => void;
  cautionM: number;
  onCautionMChange: (v: number) => void;
  iouThreshold: number;
  onIouThresholdChange: (v: number) => void;
  lightingRobustness: boolean;
  onLightingRobustnessChange: (v: boolean) => void;
  onResetDefaults: () => void;
  vlmModelOptions: ModelOption[];
  cortexLlmOptions: ModelOption[];
}

const RuntimeConfigContext = createContext<RuntimeConfigValues | null>(null);

export function RuntimeConfigProvider({
  value,
  children,
}: {
  value: RuntimeConfigValues;
  children: ReactNode;
}) {
  return (
    <RuntimeConfigContext.Provider value={value}>
      {children}
    </RuntimeConfigContext.Provider>
  );
}

export function useRuntimeConfig() {
  const ctx = useContext(RuntimeConfigContext);
  if (!ctx) throw new Error("useRuntimeConfig must be used within RuntimeConfigProvider");
  return ctx;
}
