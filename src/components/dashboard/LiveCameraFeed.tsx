import { useMemo } from "react";
import { useOpenEyeStream } from "@/hooks/useOpenEyeStream";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import type { DetectedObject } from "@/types/openeye";

type SafetyZoneLevel = "SAFE" | "CAUTION" | "DANGER";

interface SafetyZoneInfo {
  level: SafetyZoneLevel;
  color: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
}

function getPersonSafetyZone(obj: DetectedObject): SafetyZoneInfo | null {
  if (obj.label.toLowerCase() !== "person") return null;

  if (obj.bbox.h > 0.6) {
    return {
      level: "DANGER",
      color: "text-terminal-red",
      borderColor: "border-terminal-red",
      bgColor: "bg-terminal-red/15",
      textColor: "bg-terminal-red text-primary-foreground",
    };
  }
  if (obj.bbox.h > 0.3) {
    return {
      level: "CAUTION",
      color: "text-terminal-amber",
      borderColor: "border-terminal-amber",
      bgColor: "bg-terminal-amber/15",
      textColor: "bg-terminal-amber text-primary-foreground",
    };
  }
  return {
    level: "SAFE",
    color: "text-terminal-green",
    borderColor: "border-terminal-green",
    bgColor: "bg-terminal-green/15",
    textColor: "bg-terminal-green text-black",
  };
}

function getOverallSafetyStatus(objects: DetectedObject[]): SafetyZoneInfo | null {
  let worst: SafetyZoneInfo | null = null;
  for (const obj of objects) {
    const zone = getPersonSafetyZone(obj);
    if (!zone) continue;
    if (!worst || zone.level === "DANGER" || (zone.level === "CAUTION" && worst.level === "SAFE")) {
      worst = zone;
    }
  }
  return worst;
}

function fpsColor(fps: number): string {
  if (fps > 20) return "text-terminal-green";
  if (fps > 10) return "text-terminal-amber";
  return "text-red-400";
}

function latencyColor(ms: number): string {
  if (ms < 50) return "text-terminal-green";
  if (ms < 100) return "text-terminal-amber";
  return "text-red-400";
}

export function LiveCameraFeed() {
  const { videoRef, latestResult, isStreaming, metrics } = useOpenEyeStream();
  const { healthData } = useOpenEyeConnection();

  const objectCount = latestResult?.objects.length ?? 0;
  const modelName = healthData?.model ?? latestResult?.model ?? "---";
  const safetyStatus = useMemo(
    () => (latestResult ? getOverallSafetyStatus(latestResult.objects) : null),
    [latestResult],
  );
  const hasPerson = safetyStatus !== null;

  return (
    <div className="relative rounded-lg overflow-hidden bg-black border border-foreground/10 shadow-2xl">
      <video
        ref={videoRef as React.RefObject<HTMLVideoElement>}
        className="w-full aspect-video object-cover"
        muted
        playsInline
        aria-label="Live camera feed with object detection overlay"
      />

      {/* ----- Detection bounding box overlays ----- */}
      {isStreaming && latestResult && (
        <div className="absolute inset-0 pointer-events-none">
          {latestResult.objects.map((obj, i) => {
            const isHazard = obj.label.toLowerCase().includes("knife") || obj.confidence < 0.5;
            const personZone = getPersonSafetyZone(obj);
            const isPerson = personZone !== null;

            // Determine colors: person safety zone > hazard > normal
            const borderCls = isPerson
              ? personZone.borderColor
              : isHazard
                ? "border-terminal-amber"
                : "border-terminal-green";
            const bgCls = isPerson
              ? personZone.bgColor
              : isHazard
                ? "bg-terminal-amber/10"
                : "bg-terminal-green/10";
            const labelBg = isPerson
              ? personZone.textColor
              : isHazard
                ? "bg-terminal-amber text-foreground"
                : "bg-terminal-green text-primary-foreground";

            return (
              <div
                key={obj.track_id ?? `${obj.label}-${i}`}
                className="absolute"
                style={{
                  left: `${obj.bbox.x * 100}%`,
                  top: `${obj.bbox.y * 100}%`,
                  width: `${obj.bbox.w * 100}%`,
                  height: `${obj.bbox.h * 100}%`,
                }}
              >
                {/* Main box fill + border */}
                <div className={`w-full h-full border ${borderCls} ${bgCls}`} />

                {/* Label tag */}
                <span
                  className={`absolute -top-5 left-0 text-[10px] font-mono font-semibold px-1.5 py-0.5 tabular-nums whitespace-nowrap ${labelBg}`}
                >
                  {obj.label} [{(obj.confidence * 100).toFixed(1)}%]
                </span>

                {/* Safety zone badge for persons */}
                {isPerson && (
                  <span
                    className={`absolute -top-5 right-0 text-[9px] font-mono font-bold px-1.5 py-0.5 tracking-wider ${personZone.textColor} ${
                      personZone.level === "DANGER" ? "animate-pulse" : ""
                    }`}
                  >
                    {personZone.level}
                  </span>
                )}

                {/* Corner brackets */}
                <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 ${borderCls}`} />
                <div className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 ${borderCls}`} />
                <div className={`absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 ${borderCls}`} />
                <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 ${borderCls}`} />

                {/* Distance/zone bar for persons */}
                {isPerson && (
                  <div className="absolute -bottom-4 left-0 right-0 flex justify-center">
                    <span
                      className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded-sm ${personZone.textColor} opacity-90`}
                    >
                      ZONE: {personZone.level}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ----- HUD: Top-left panel ----- */}
      {isStreaming && (
        <div className="absolute top-3 left-3 font-mono text-[11px] pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm rounded-md border border-white/10 px-3 py-2.5 space-y-1.5 min-w-[170px]">
            {/* Title row */}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-terminal-green animate-pulse shadow-[0_0_6px_hsl(160,59%,50%)]" />
              <span className="text-white font-semibold tracking-wider text-[11px]">
                OPENEYE LIVE
              </span>
            </div>

            <div className="border-t border-white/10 pt-1.5 space-y-1">
              {/* FPS */}
              <div className="flex justify-between items-center">
                <span className="text-white/50">FPS</span>
                <span className={`tabular-nums font-semibold ${fpsColor(metrics.fps)}`}>
                  {metrics.fps}
                </span>
              </div>

              {/* Latency */}
              <div className="flex justify-between items-center">
                <span className="text-white/50">LATENCY</span>
                <span className={`tabular-nums font-semibold ${latencyColor(metrics.latency_ms)}`}>
                  {metrics.latency_ms.toFixed(0)}ms
                </span>
              </div>

              {/* Object count */}
              <div className="flex justify-between items-center">
                <span className="text-white/50">OBJECTS</span>
                <span className="tabular-nums font-semibold text-white">
                  {objectCount}
                </span>
              </div>

              {/* Model */}
              <div className="flex justify-between items-center">
                <span className="text-white/50">MODEL</span>
                <span className="text-terminal-green text-[10px] truncate max-w-[100px] text-right block">
                  {modelName}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----- HUD: Top-right safety status ----- */}
      {isStreaming && hasPerson && safetyStatus && (
        <div className="absolute top-3 right-3 font-mono text-[11px] pointer-events-none">
          <div
            className={`bg-black/70 backdrop-blur-sm rounded-md border px-3 py-2.5 ${
              safetyStatus.level === "DANGER"
                ? "border-red-500/50"
                : safetyStatus.level === "CAUTION"
                  ? "border-terminal-amber/50"
                  : "border-terminal-green/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-[10px]">SAFETY</span>
              <span
                className={`font-bold tracking-wider ${safetyStatus.color} ${
                  safetyStatus.level === "DANGER" ? "animate-pulse" : ""
                }`}
              >
                {safetyStatus.level}
              </span>
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  safetyStatus.level === "DANGER"
                    ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                    : safetyStatus.level === "CAUTION"
                      ? "bg-terminal-amber shadow-[0_0_6px_hsl(38,92%,50%,0.5)]"
                      : "bg-terminal-green shadow-[0_0_6px_hsl(160,59%,50%,0.5)]"
                }`}
              />
            </div>
          </div>
        </div>
      )}

      {/* ----- HUD: Bottom-right LIVE indicator ----- */}
      {isStreaming && (
        <div className="absolute bottom-3 right-3 font-mono text-[11px] pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm rounded-md border border-white/10 px-3 py-1.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="text-red-400 font-bold tracking-wider">REC</span>
              <span className="text-white/40 tabular-nums text-[10px]">
                {metrics.frame_count}f
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ----- HUD: Bottom-left frame counter / model ----- */}
      {isStreaming && (
        <div className="absolute bottom-3 left-3 font-mono text-[10px] text-white/40 pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm rounded-md border border-white/10 px-3 py-1.5">
            <span className="tabular-nums">{metrics.frame_count} frames</span>
            <span className="mx-1.5 text-white/20">|</span>
            <span className="text-terminal-green/70">{modelName}</span>
          </div>
        </div>
      )}

      {/* ----- Scanline effect for style ----- */}
      {isStreaming && (
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
          }}
        />
      )}

      {/* ----- Not streaming placeholder ----- */}
      {!isStreaming && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-center space-y-2">
            <div className="font-mono text-sm text-white/50 tracking-wider">
              CAMERA OFFLINE
            </div>
            <div className="font-mono text-[10px] text-white/30">
              Click "Start Camera" to begin streaming
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
