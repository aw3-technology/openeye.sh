import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Brain, Sparkles } from "lucide-react";
import { vlmScenes } from "./vlm-data";

export function VLMReasoningDemo() {
  const [selectedScene, setSelectedScene] = useState(0);
  const [stage, setStage] = useState<"idle" | "detecting" | "reasoning" | "complete">("idle");
  const [visibleChars, setVisibleChars] = useState(0);
  const [showDetections, setShowDetections] = useState(false);
  const charTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scene = vlmScenes[selectedScene];
  const fullText = `${scene.vlm.description}\n\n${scene.vlm.reasoning}`;

  const analyze = useCallback(() => {
    setShowDetections(false);
    setVisibleChars(0);
    setStage("detecting");
    if (charTimerRef.current) clearInterval(charTimerRef.current);

    setTimeout(() => {
      setShowDetections(true);
      setStage("reasoning");

      let chars = 0;
      charTimerRef.current = setInterval(() => {
        chars++;
        setVisibleChars(chars);
        if (chars >= fullText.length) {
          if (charTimerRef.current) clearInterval(charTimerRef.current);
          setStage("complete");
        }
      }, 12);
    }, 600 + Math.random() * 200);
  }, [fullText.length]);

  useEffect(() => {
    return () => {
      if (charTimerRef.current) clearInterval(charTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [visibleChars]);

  const safetyClasses =
    scene.vlm.safety === "DANGER"
      ? { border: "border-oe-red", bg: "bg-oe-red/5", text: "text-oe-red", dot: "bg-oe-red animate-pulse" }
      : scene.vlm.safety === "CAUTION"
      ? { border: "border-primary", bg: "bg-primary/5", text: "text-primary", dot: "bg-primary" }
      : { border: "border-oe-green", bg: "bg-oe-green/5", text: "text-oe-green", dot: "bg-oe-green" };

  return (
    <div className="space-y-6">
      {/* Scene selector */}
      <div className="flex flex-wrap gap-3">
        {vlmScenes.map((s, i) => (
          <button
            key={s.name}
            onClick={() => {
              if (charTimerRef.current) clearInterval(charTimerRef.current);
              setSelectedScene(i);
              setStage("idle");
              setShowDetections(false);
              setVisibleChars(0);
            }}
            className={`px-4 py-2 rounded-lg border font-mono text-sm transition-colors ${
              i === selectedScene
                ? "bg-primary/10 border-primary text-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Scene viewport */}
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
              onClick={analyze}
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

        {/* Right panel: VLM output */}
        <div className="flex flex-col gap-4">
          {/* VLM Reasoning output */}
          <div className="bg-card rounded-xl border overflow-hidden flex-1 min-h-0">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">VLM Reasoning</span>
              </div>
              <span className="font-mono text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20">
                Nebius Token Factory
              </span>
            </div>
            <div ref={scrollRef} className="p-4 font-mono text-xs leading-relaxed max-h-[320px] overflow-y-auto scrollbar-thin">
              {stage === "idle" ? (
                <div className="text-muted-foreground py-8 text-center">
                  <Sparkles className="w-5 h-5 mx-auto mb-2 opacity-50" />
                  Click "Analyze Scene" to run dual-layer perception
                </div>
              ) : stage === "detecting" ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <div className="w-3 h-3 border-2 border-oe-green border-t-transparent rounded-full animate-spin" />
                  Running YOLO detection...
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Scene Description */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Eye className="w-3 h-3 text-purple-400" />
                      <span className="text-[10px] text-purple-400 uppercase tracking-wider">Scene Description</span>
                    </div>
                    <p className="text-foreground/90 bg-foreground/5 rounded-md p-3 border border-foreground/5">
                      {fullText.slice(0, visibleChars).split("\n\n")[0]}
                      {visibleChars < scene.vlm.description.length && (
                        <span className="inline-block w-1.5 h-3 bg-purple-400 animate-cursor-blink ml-0.5" />
                      )}
                    </p>
                  </div>

                  {/* Reasoning (appears after description is done) */}
                  {visibleChars > scene.vlm.description.length + 2 && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Brain className="w-3 h-3 text-purple-400" />
                        <span className="text-[10px] text-purple-400 uppercase tracking-wider">Reasoning</span>
                      </div>
                      <p className="text-foreground/80 bg-foreground/5 rounded-md p-3 border border-foreground/5">
                        {fullText.slice(scene.vlm.description.length + 2, visibleChars)}
                        {visibleChars < fullText.length && (
                          <span className="inline-block w-1.5 h-3 bg-purple-400 animate-cursor-blink ml-0.5" />
                        )}
                      </p>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Safety Assessment */}
          <AnimatePresence>
            {stage === "complete" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`rounded-xl border-2 overflow-hidden ${safetyClasses.border} ${safetyClasses.bg}`}
              >
                <div className="px-5 py-3 flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Safety Assessment</span>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${safetyClasses.dot}`} />
                    <span className={`font-mono text-sm font-semibold ${safetyClasses.text}`}>
                      {scene.vlm.safety}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Plan */}
          <AnimatePresence>
            {stage === "complete" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-card rounded-xl border overflow-hidden"
              >
                <div className="px-5 py-3 border-b border-border">
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Action Plan</span>
                </div>
                <div className="p-4 space-y-2">
                  {scene.vlm.actions.map((action, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className="flex items-start gap-2 font-mono text-xs"
                    >
                      <span className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${
                        action.priority === "critical" ? "bg-oe-red" :
                        action.priority === "high" ? "bg-primary" :
                        action.priority === "medium" ? "bg-terminal-amber" :
                        "bg-oe-green"
                      }`} />
                      <span className="text-foreground/80">{action.text}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pipeline stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "YOLO", value: showDetections ? `${scene.yoloTime}ms` : "\u2014", color: "text-oe-green" },
              { label: "VLM", value: stage === "complete" ? "1.8s" : stage === "reasoning" ? "..." : "\u2014", color: "text-purple-400" },
              { label: "Objects", value: showDetections ? String(scene.objects.length) : "\u2014", color: "text-foreground" },
            ].map((s) => (
              <div key={s.label} className="bg-card rounded-lg border px-3 py-3 text-center">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
                <div className={`font-mono text-sm tabular-nums mt-1 ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="font-mono text-xs text-muted-foreground text-center">
        Dual-layer perception: fast YOLO detection + deep VLM reasoning — no server required
      </p>
    </div>
  );
}
