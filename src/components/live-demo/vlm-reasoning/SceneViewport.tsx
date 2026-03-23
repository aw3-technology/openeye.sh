import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { VLMScene } from "../vlm-data";

interface SceneViewportProps {
  scene: VLMScene;
  selectedScene: number;
  stage: "idle" | "detecting" | "reasoning" | "complete";
  showDetections: boolean;
  onAnalyze: () => void;
}

export function SceneViewport({ scene, selectedScene, stage, showDetections, onAnalyze }: SceneViewportProps) {
  return (
    <div className="lg:col-span-2">
      <div className="relative aspect-video bg-card border rounded-xl overflow-hidden">
        <img src={scene.image} alt={`${scene.name} scene`} className="absolute inset-0 w-full h-full object-cover" />

        {/* YOLO detection boxes */}
        <AnimatePresence>
          {showDetections &&
            scene.objects.map((obj, i) => {
              const isPerson = obj.label === "person";
              return (
                <motion.div
                  key={`${selectedScene}-${i}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.2 }}
                  className="absolute"
                  style={{
                    left: `${obj.bbox.x * 100}%`,
                    top: `${obj.bbox.y * 100}%`,
                    width: `${obj.bbox.w * 100}%`,
                    height: `${obj.bbox.h * 100}%`,
                  }}
                >
                  <div className={`w-full h-full border-2 ${isPerson ? "border-oe-red bg-oe-red/10" : "border-oe-green bg-oe-green/10"}`} />
                  <span className={`absolute -top-5 left-0 text-[10px] font-mono px-1.5 py-0.5 ${isPerson ? "bg-oe-red" : "bg-oe-green"} text-primary-foreground whitespace-nowrap`}>
                    {obj.label} [{(obj.confidence * 100).toFixed(1)}%]
                  </span>
                  <div className={`absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 ${isPerson ? "border-oe-red" : "border-oe-green"}`} />
                  <div className={`absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 ${isPerson ? "border-oe-red" : "border-oe-green"}`} />
                  <div className={`absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 ${isPerson ? "border-oe-red" : "border-oe-green"}`} />
                  <div className={`absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 ${isPerson ? "border-oe-red" : "border-oe-green"}`} />
                </motion.div>
              );
            })}
        </AnimatePresence>

        {/* Processing overlay */}
        {stage === "detecting" && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
            <div className="flex items-center gap-3 font-mono text-sm">
              <div className="w-4 h-4 border-2 border-oe-green border-t-transparent rounded-full animate-spin" />
              YOLO detecting...
            </div>
          </div>
        )}

        {/* HUD overlay */}
        <div className="absolute top-3 left-3 font-mono text-[10px] text-terminal-green/70 space-y-0.5">
          <div>OPENEYE DUAL-LAYER v0.1.0</div>
          <div className="tabular-nums">YOLO + VLM PIPELINE</div>
        </div>

        {/* Stage indicator */}
        {stage !== "idle" && (
          <div className="absolute top-3 right-3">
            <div className={`flex items-center gap-1.5 font-mono text-[10px] bg-card/80 backdrop-blur-sm px-2.5 py-1 rounded border ${
              stage === "complete" ? "border-oe-green/30 text-oe-green" : "border-primary/30 text-primary"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${stage === "complete" ? "bg-oe-green" : "bg-primary animate-pulse"}`} />
              {stage === "detecting" ? "YOLO" : stage === "reasoning" ? "VLM..." : "COMPLETE"}
            </div>
          </div>
        )}
      </div>

      {/* Analyze button + pipeline badges */}
      <div className="flex items-center gap-4 mt-4">
        <button
          onClick={onAnalyze}
          disabled={stage === "detecting" || stage === "reasoning"}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-mono text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-[0.98]"
        >
          <Sparkles className="w-4 h-4" />
          Analyze Scene
        </button>
        <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
          {showDetections && (
            <span className="text-oe-green">YOLO: {scene.yoloTime}ms</span>
          )}
          {stage === "reasoning" && (
            <span className="text-purple-400 animate-pulse">VLM: streaming...</span>
          )}
          {stage === "complete" && (
            <span className="text-purple-400">VLM: 1.8s</span>
          )}
        </div>
      </div>
    </div>
  );
}
