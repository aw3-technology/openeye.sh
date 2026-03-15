import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { OpenEyeClient, getStoredServerUrl, setStoredServerUrl } from "@/lib/openeye-client";
import { isCloudDeployment as checkCloudDeployment } from "@/lib/deployment-env";
import type { HealthResponse } from "@/types/openeye";

/** Interval between health check polls (ms) */
const HEALTH_POLL_INTERVAL_MS = 5000;

interface OpenEyeConnectionContextValue {
  serverUrl: string;
  setServerUrl: (url: string) => void;
  client: OpenEyeClient;
  isConnected: boolean;
  healthData: HealthResponse | null;
  isCloudDeployment: boolean;
}

const OpenEyeConnectionContext = createContext<OpenEyeConnectionContextValue | null>(null);

export function OpenEyeConnectionProvider({ children }: { children: ReactNode }) {
  const [serverUrl, _setServerUrl] = useState(getStoredServerUrl);
  const [isConnected, setIsConnected] = useState(false);
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const queryClient = useQueryClient();

  // Use useMemo so client is a stable reference that updates (and triggers re-renders)
  // when serverUrl changes, unlike useRef which doesn't cause re-renders.
  const client = useMemo(() => new OpenEyeClient(serverUrl), [serverUrl]);

  const setServerUrl = useCallback((url: string) => {
    setStoredServerUrl(url);
    _setServerUrl(url);
    setIsConnected(false);
    setHealthData(null);
    queryClient.clear();
  }, [queryClient]);

  const isCloud = useMemo(() => checkCloudDeployment(), []);

  // Skip health polling when using default localhost URL on a deployed (non-localhost) origin
  const isDefaultLocalhost = serverUrl === "http://localhost:8000" && typeof window !== "undefined" && window.location.hostname !== "localhost";

  useEffect(() => {
    if (isDefaultLocalhost) {
      setIsConnected(false);
      setHealthData(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const data = await client.health();
        if (!cancelled) {
          setIsConnected(true);
          setHealthData(data);
        }
      } catch {
        if (!cancelled) {
          setIsConnected(false);
          setHealthData(null);
        }
      }
    };

    poll();
    const id = setInterval(poll, HEALTH_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client, serverUrl]);

  return (
    <OpenEyeConnectionContext.Provider
      value={{ serverUrl, setServerUrl, client, isConnected, healthData, isCloudDeployment: isCloud }}
    >
      {children}
    </OpenEyeConnectionContext.Provider>
  );
}

export function useOpenEyeConnection() {
  const ctx = useContext(OpenEyeConnectionContext);
  if (!ctx) throw new Error("useOpenEyeConnection must be used within OpenEyeConnectionProvider");
  return ctx;
}
