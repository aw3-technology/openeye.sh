import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  X,
  Grid3X3,
} from "lucide-react";

import logoHorizontal from "@/assets/openeye-logo-horizontal.png";
import logoHorizontalDark from "@/assets/openeye-logo-horizontal-dark.png";

import { slides, ScaledSlide } from "./slides";

// ─── Presentation Page ───────────────────────────────────────────────────

export default function Presentation() {
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();

  const total = slides.length;

  const goTo = useCallback(
    (n: number) => {
      setCurrent(Math.max(0, Math.min(n, total - 1)));
      setShowGrid(false);
    },
    [total],
  );

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFSChange);
    return () => document.removeEventListener("fullscreenchange", onFSChange);
  }, []);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        if (showGrid) setShowGrid(false);
        else if (document.fullscreenElement) document.exitFullscreen();
        else navigate("/");
      } else if (e.key === "f" || e.key === "F5") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "g") {
        setShowGrid((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, navigate, toggleFullscreen, showGrid]);

  // Auto-hide controls in fullscreen
  useEffect(() => {
    if (!isFullscreen) {
      setShowControls(true);
      return;
    }

    const onMove = () => {
      setShowControls(true);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowControls(false), 2500);
    };

    onMove();
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      clearTimeout(hideTimer.current);
    };
  }, [isFullscreen]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-background flex flex-col select-none"
      style={{ cursor: isFullscreen && !showControls ? "none" : undefined }}
    >
      {/* Top bar */}
      <AnimatePresence>
        {showControls && !showGrid && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.15 }}
            className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-sm border-b border-border"
          >
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/")}
                className="p-2 rounded-lg hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
                title="Exit (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="h-7 flex items-center">
                <img src={logoHorizontalDark} alt="OpenEye" className="h-7 logo-dark" />
                <img src={logoHorizontal} alt="OpenEye" className="h-7 logo-light" />
              </div>
              <span className="font-mono text-sm text-muted-foreground">
                Slide {current + 1} of {total}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGrid((v) => !v)}
                className="p-2 rounded-lg hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
                title="Grid view (G)"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
                title="Fullscreen (F)"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid view */}
      {showGrid ? (
        <div className="flex-1 overflow-y-auto p-8 pt-16">
          <div className="grid grid-cols-4 gap-6 max-w-[1600px] mx-auto">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                onClick={() => goTo(i)}
                className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all hover:scale-[1.02] ${
                  i === current ? "border-primary shadow-lg" : "border-border hover:border-primary/50"
                }`}
              >
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div
                    style={{
                      width: 1920,
                      height: 1080,
                      transform: "scale(0.18)",
                      transformOrigin: "top left",
                    }}
                  >
                    {slide.content}
                  </div>
                </div>
                <div className="absolute bottom-2 left-2 font-mono text-xs bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
                  {i + 1}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Main slide */}
          <div className="flex-1 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0"
              >
                <ScaledSlide>{slides[current].content}</ScaledSlide>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation arrows */}
          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-y-0 left-0 right-0 z-40 flex items-center justify-between pointer-events-none px-4"
              >
                <button
                  onClick={prev}
                  disabled={current === 0}
                  className="p-3 rounded-full bg-card/80 backdrop-blur-sm border shadow-md pointer-events-auto disabled:opacity-30 disabled:cursor-default hover:bg-card transition-colors text-foreground"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={next}
                  disabled={current === total - 1}
                  className="p-3 rounded-full bg-card/80 backdrop-blur-sm border shadow-md pointer-events-auto disabled:opacity-30 disabled:cursor-default hover:bg-card transition-colors text-foreground"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 z-50 h-1 bg-border">
            <motion.div
              className="h-full bg-gradient-to-r from-oe-blue via-primary to-oe-green"
              animate={{ width: `${((current + 1) / total) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </>
      )}
    </div>
  );
}
