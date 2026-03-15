import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { SafetyState } from "./types";
import { stateConfig, workspaceObjects, HAND_SIZE } from "./data";

interface CameraFeedProps {
  currentState: SafetyState;
  handVisible: boolean;
  handPosition: { x: number; y: number };
  robotPaused: boolean;
}

export function CameraFeed({
  currentState,
  handVisible,
  handPosition,
  robotPaused,
}: CameraFeedProps) {
  const shouldReduceMotion = useReducedMotion();
  const config = stateConfig[currentState];
  const animDuration = shouldReduceMotion ? 0 : 0.15;

  return (
    <div className="lg:col-span-3">
      <motion.div
        className="relative border rounded-outer overflow-hidden bg-terminal-bg"
        animate={{
          borderColor: config.border,
          boxShadow: currentState === "danger"
            ? `0 0 30px hsl(var(--terminal-red) / 0.3), inset 0 0 30px hsl(var(--terminal-red) / 0.05)`
            : currentState === "warning"
            ? `0 0 20px hsl(var(--terminal-amber) / 0.2)`
            : `0 0 10px hsl(var(--terminal-green) / 0.1)`,
        }}
        transition={{ duration: animDuration }}
      >
        <div className="relative aspect-video bg-terminal-bg">
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--terminal-green)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--terminal-green)) 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />

          {/* Danger zone polygon */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
            <motion.rect
              x="12%"
              y="15%"
              width="60%"
              height="70%"
              rx="4"
              fill="none"
              strokeDasharray="8 4"
              strokeWidth="1"
              animate={{
                stroke: currentState === "danger"
                  ? "hsl(var(--terminal-red))"
                  : currentState === "warning"
                  ? "hsl(var(--terminal-amber))"
                  : "hsl(var(--terminal-green))",
                opacity: currentState === "danger" ? 0.6 : 0.2,
              }}
              transition={{ duration: animDuration }}
            />
            <text
              x="14%"
              y="13%"
              fontSize="8"
              fontFamily="Geist Mono, monospace"
              className="fill-terminal-muted"
              opacity="0.5"
            >
              WORKSPACE ZONE
            </text>
          </svg>

          {/* Workspace objects */}
          {workspaceObjects.map((obj) => {
            const isHaltedArm = obj.name === "ROBOT_ARM" && robotPaused;
            return (
              <div
                key={obj.name}
                className="absolute"
                style={{
                  left: `${obj.x}%`,
                  top: `${obj.y}%`,
                  width: `${obj.w}%`,
                  height: `${obj.h}%`,
                }}
              >
                <motion.div
                  className="w-full h-full border-[0.5px]"
                  animate={{
                    borderColor: isHaltedArm
                      ? "hsl(var(--terminal-red))"
                      : "hsl(var(--terminal-green))",
                    backgroundColor: isHaltedArm
                      ? "hsl(var(--terminal-red) / 0.1)"
                      : "hsl(var(--terminal-green) / 0.05)",
                  }}
                  transition={{ duration: animDuration }}
                />
                <motion.span
                  className="absolute -top-4 left-0 text-[9px] font-mono px-1 py-0.5 whitespace-nowrap leading-none"
                  animate={{
                    backgroundColor: isHaltedArm
                      ? "hsl(var(--terminal-red))"
                      : "hsl(var(--terminal-green))",
                    color: isHaltedArm
                      ? "hsl(0 0% 100%)"
                      : "hsl(var(--foreground))",
                  }}
                  transition={{ duration: animDuration }}
                >
                  {obj.name}{isHaltedArm ? " [HALTED]" : ""}
                </motion.span>
                <div className={`absolute top-0 left-0 w-2 h-2 border-t border-l ${isHaltedArm ? "border-terminal-red" : "border-terminal-green"}`} />
                <div className={`absolute top-0 right-0 w-2 h-2 border-t border-r ${isHaltedArm ? "border-terminal-red" : "border-terminal-green"}`} />
                <div className={`absolute bottom-0 left-0 w-2 h-2 border-b border-l ${isHaltedArm ? "border-terminal-red" : "border-terminal-green"}`} />
                <div className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r ${isHaltedArm ? "border-terminal-red" : "border-terminal-green"}`} />
              </div>
            );
          })}

          {/* Hand intrusion */}
          <AnimatePresence>
            {handVisible && (
              <motion.div
                key="hand-intrusion"
                className="absolute"
                initial={shouldReduceMotion ? { opacity: 0 } : { x: "-100%", opacity: 0 }}
                animate={{
                  left: `${handPosition.x}%`,
                  top: `${handPosition.y}%`,
                  opacity: 1,
                  x: "0%",
                }}
                exit={shouldReduceMotion ? { opacity: 0 } : { x: "-100%", opacity: 0 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                style={{ width: `${HAND_SIZE.w}%`, height: `${HAND_SIZE.h}%` }}
              >
                <div className="w-full h-full border-[1.5px] border-terminal-red bg-terminal-red/15 animate-pulse" />
                <span className="absolute -top-4 left-0 text-[9px] font-mono px-1 py-0.5 bg-terminal-red text-white whitespace-nowrap leading-none">
                  HUMAN_HAND [97.3%]
                </span>
                <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-terminal-red" />
                <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-terminal-red" />
                <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-terminal-red" />
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-terminal-red" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Danger flash overlay */}
          <AnimatePresence>
            {currentState === "danger" && (
              <motion.div
                key="danger-flash"
                className="absolute inset-0 bg-terminal-red/10 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={shouldReduceMotion ? { opacity: 0.15 } : { opacity: [0, 0.3, 0.1, 0.2, 0.1] }}
                exit={{ opacity: 0 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}
              />
            )}
          </AnimatePresence>

          {/* HUD overlay */}
          <div className="absolute top-3 left-3 font-mono text-[10px] text-terminal-green/70 space-y-0.5">
            <div>OPENEYE GUARDIAN v0.1.0</div>
            <div className="tabular-nums">FPS: 30 | MODE: SAFETY MONITOR</div>
            <motion.div
              className="tabular-nums"
              animate={{
                color: currentState === "danger"
                  ? "hsl(var(--terminal-red))"
                  : currentState === "warning"
                  ? "hsl(var(--terminal-amber))"
                  : "hsl(var(--terminal-green) / 0.7)",
              }}
              transition={{ duration: animDuration }}
            >
              STATUS: {config.label}
            </motion.div>
          </div>

          <div className="absolute bottom-3 right-3 font-mono text-[10px]">
            <div className="flex items-center gap-1.5">
              <motion.span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                animate={{
                  backgroundColor: currentState === "danger"
                    ? "hsl(var(--terminal-red))"
                    : "hsl(var(--terminal-green))",
                }}
                transition={{ duration: animDuration }}
              />
              <motion.span
                animate={{
                  color: currentState === "danger"
                    ? "hsl(var(--terminal-red))"
                    : "hsl(var(--terminal-green) / 0.7)",
                }}
                transition={{ duration: animDuration }}
              >
                {currentState === "danger" ? "HALTED" : "MONITORING"}
              </motion.span>
            </div>
          </div>

          {/* Big center alert */}
          <AnimatePresence>
            {currentState === "danger" && (
              <motion.div
                key="center-alert"
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.9 }}
                transition={{ duration: animDuration }}
              >
                <div className="bg-terminal-red/90 text-white font-mono text-xs sm:text-sm md:text-base px-4 sm:px-6 py-2 sm:py-3 rounded-inner backdrop-blur-sm">
                  HUMAN DETECTED — OPERATIONS HALTED
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
