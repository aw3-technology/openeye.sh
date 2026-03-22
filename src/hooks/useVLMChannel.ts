import { useRef } from "react";
import { OpenEyeWebSocket } from "@/lib/openeye-ws";
import type { VLMReasoning } from "@/types/openeye";

export const VLM_INTERVAL_MS = 2500;

interface UseVLMChannelParams {
  setLatestVLM: (vlm: VLMReasoning) => void;
  setVlmLoading: (v: boolean) => void;
  latestVLMRef: React.RefObject<VLMReasoning | null>;
}

export function useVLMChannel({
  setLatestVLM,
  setVlmLoading,
  latestVLMRef,
}: UseVLMChannelParams) {
  const vlmWsRef = useRef<OpenEyeWebSocket | null>(null);
  const vlmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Create and connect the VLM WebSocket, returning the instance. */
  function connectVLM(serverUrl: string): OpenEyeWebSocket {
    const vlmWs = new OpenEyeWebSocket(serverUrl, "/ws/vlm");
    vlmWsRef.current = vlmWs;

    vlmWs.subscribe((data) => {
      const vlm = data as VLMReasoning;
      if (vlm.description !== undefined) {
        latestVLMRef.current = vlm;
        setLatestVLM(vlm);
        setVlmLoading(false);
      }
    });

    vlmWs.connect();
    return vlmWs;
  }

  /** Start the slow-channel interval that sends frames every VLM_INTERVAL_MS. */
  function startVLMInterval(lastBase64Ref: React.RefObject<string>) {
    const vlmWs = vlmWsRef.current;
    if (!vlmWs) return;
    vlmIntervalRef.current = setInterval(() => {
      const base64 = lastBase64Ref.current;
      if (base64 && vlmWs.connected) {
        setVlmLoading(true);
        vlmWs.send(base64);
      }
    }, VLM_INTERVAL_MS);
  }

  return {
    vlmWsRef,
    vlmIntervalRef,
    connectVLM,
    startVLMInterval,
  };
}
