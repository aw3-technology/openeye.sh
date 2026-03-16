import { motion, AnimatePresence } from "framer-motion";
import { usePerceptionStream } from "@/hooks/usePerceptionStream";
import { Camera } from "lucide-react";

const stateConfig = {
  safe: {
    label: "SAFE",
    border: "hsl(var(--terminal-green))",
    shadow: "0 0 10px hsl(var(--terminal-green) / 0.1)",
  },
  caution: {
    label: "CAUTION",
    border: "hsl(var(--terminal-amber))",
    shadow: "0 0 20px hsl(var(--terminal-amber) / 0.2)",
  },
  danger: {
    label: "DANGER",
    border: "hsl(var(--terminal-red))",
    shadow: "0 0 30px hsl(var(--terminal-red) / 0.3), inset 0 0 30px hsl(var(--terminal-red) / 0.05)",
  },
};

export function DemoFeed() {
  const {
    isStreaming,
    latestFrame,
    metrics,
    overallSafetyState,
    haltActive,
    mode,
    videoRef,
    replayCanvasRef,
    startStream,
  } = usePerceptionStream();

  const config = stateConfig[overallSafetyState];
  const isActive = mode === "live" || mode === "replay";

  return (
    <motion.div
      className="relative border rounded-outer overflow-hidden bg-terminal-bg"
      animate={{
        borderColor: isActive ? config.border : "hsl(var(--border))",
        boxShadow: isActive ? config.shadow : "none",
      }}
      transition={{ duration: 0.15 }}
    >
      <div className="relative aspect-video bg-terminal-bg">
        {/* Video element for live mode */}
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          className={`absolute inset-0 w-full h-full object-cover ${mode === "live" ? "" : "hidden"}`}
          muted
          playsInline
        />

        {/* Canvas for replay mode */}
        <canvas
          ref={replayCanvasRef as React.RefObject<HTMLCanvasElement>}
          className={`absolute inset-0 w-full h-full object-cover ${mode === "replay" ? "" : "hidden"}`}
        />

        {/* Grid overlay */}
        {isActive && (
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--terminal-green)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--terminal-green)) 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />
        )}

        {/* Workspace zone rectangle */}
        {isActive && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <motion.rect
              x="5%"
              y="5%"
              width="90%"
              height="90%"
              rx="4"
              fill="none"
              strokeDasharray="8 4"
              strokeWidth="1"
              animate={{
                stroke: config.border,
                opacity: overallSafetyState === "danger" ? 0.6 : 0.2,
              }}
              transition={{ duration: 0.15 }}
            />
            <text
              x="7%"
              y="4%"
              fontSize="8"
              fontFamily="Geist Mono, monospace"
              className="fill-terminal-muted"
              opacity="0.5"
            >
              WORKSPACE ZONE
            </text>
          </svg>
        )}

        {/* Detection bounding boxes */}
        <AnimatePresence>
          {isActive && latestFrame?.objects?.map((obj) => {
            const isHuman = obj.label.toLowerCase() === "person";
            const isHazard = isHuman || obj.label.toLowerCase().includes("knife");
            const borderColor = isHuman
              ? "border-terminal-red"
              : isHazard
              ? "border-terminal-amber"
              : "border-terminal-green";
            const bgColor = isHuman
              ? "bg-terminal-red/10"
              : isHazard
              ? "bg-terminal-amber/10"
              : "bg-terminal-green/10";
            const labelBg = isHuman
              ? "bg-terminal-red"
              : isHazard
              ? "bg-terminal-amber"
              : "bg-terminal-green";
            const labelText = isHuman ? "text-primary-foreground" : isHazard ? "text-primary-foreground" : "text-primary-foreground";

            return (
              <motion.div
                key={obj.track_id}
                className="absolute"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  left: `${obj.bbox.x * 100}%`,
                  top: `${obj.bbox.y * 100}%`,
                  width: `${obj.bbox.w * 100}%`,
                  height: `${obj.bbox.h * 100}%`,
                }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.1, ease: "easeOut" }}
                style={{
                  left: `${obj.bbox.x * 100}%`,
                  top: `${obj.bbox.y * 100}%`,
                  width: `${obj.bbox.w * 100}%`,
                  height: `${obj.bbox.h * 100}%`,
                }}
              >
                <div className={`w-full h-full border-[0.5px] ${borderColor} ${bgColor}`} />
                <span className={`absolute -top-5 left-0 text-[10px] font-mono px-1.5 py-0.5 tabular-nums whitespace-nowrap ${labelBg} ${labelText}`}>
                  {obj.label} [{(obj.confidence * 100).toFixed(1)}%]
                </span>
                {/* Corner markers */}
                <div className={`absolute top-0 left-0 w-2 h-2 border-t border-l ${borderColor}`} />
                <div className={`absolute top-0 right-0 w-2 h-2 border-t border-r ${borderColor}`} />
                <div className={`absolute bottom-0 left-0 w-2 h-2 border-b border-l ${borderColor}`} />
                <div className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r ${borderColor}`} />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Danger flash overlay */}
        <AnimatePresence>
          {haltActive && (
            <motion.div
              key="danger-flash"
              className="absolute inset-0 bg-terminal-red/10 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.3, 0.1, 0.2, 0.1] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          )}
        </AnimatePresence>

        {/* Halt center alert */}
        <AnimatePresence>
          {haltActive && (
            <motion.div
              key="halt-alert"
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
            >
              <div className="bg-terminal-red/90 text-primary-foreground font-mono text-xs sm:text-sm md:text-base px-4 sm:px-6 py-2 sm:py-3 rounded-inner backdrop-blur-sm">
                HUMAN DETECTED — OPERATIONS HALTED
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HUD overlay */}
        {isActive && (
          <div className="absolute top-3 left-3 font-mono text-[10px] text-terminal-green/70 space-y-0.5">
            <div>OPENEYE GUARDIAN v0.1.0</div>
            <div className="tabular-nums">
              FPS: {metrics.fps} | LAT: {metrics.latency_ms.toFixed(0)}ms | OBJ: {latestFrame?.objects.length ?? 0}
            </div>
            <motion.div
              className="tabular-nums"
              animate={{
                color: config.border,
              }}
              transition={{ duration: 0.15 }}
            >
              STATUS: {config.label}
            </motion.div>
          </div>
        )}

        {/* LIVE / REPLAY indicator */}
        {isActive && (
          <div className="absolute bottom-3 right-3 font-mono text-[10px]">
            <div className="flex items-center gap-1.5">
              <motion.span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                animate={{
                  backgroundColor: mode === "replay"
                    ? "hsl(var(--terminal-amber))"
                    : haltActive
                    ? "hsl(var(--terminal-red))"
                    : "hsl(var(--terminal-green))",
                }}
                transition={{ duration: 0.15 }}
              />
              <motion.span
                animate={{
                  color: mode === "replay"
                    ? "hsl(var(--terminal-amber))"
                    : haltActive
                    ? "hsl(var(--terminal-red))"
                    : "hsl(var(--terminal-green) / 0.7)",
                }}
                transition={{ duration: 0.15 }}
              >
                {mode === "replay" ? "REPLAY" : haltActive ? "HALTED" : "LIVE"}
              </motion.span>
            </div>
          </div>
        )}

        {/* Idle state: Start Camera prompt */}
        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="font-mono text-xs text-terminal-muted space-y-1 text-center">
              <div>OPENEYE GUARDIAN v0.1.0</div>
              <div className="text-terminal-muted/50">Camera feed offline</div>
            </div>
            <button
              onClick={() => startStream()}
              className="flex items-center gap-2 px-4 py-2 bg-terminal-green/10 border border-terminal-green/30 rounded-inner font-mono text-xs text-terminal-green hover:bg-terminal-green/20 transition-colors animate-pulse"
            >
              <Camera className="w-3.5 h-3.5" />
              Start Camera
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
