import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

import logoHorizontal from "@/assets/openeye-logo-horizontal.png";
import logoHorizontalDark from "@/assets/openeye-logo-horizontal-dark.png";

// ─── Visual Components ────────────────────────────────────────────────────

export function GridBackground({ opacity = 0.04 }: { opacity?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ opacity }}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--foreground) / 0.15) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--foreground) / 0.15) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
}

export function GlowOrb({ color, size, x, y, blur = 200 }: { color: string; size: number; x: string; y: string; blur?: number }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        background: color,
        filter: `blur(${blur}px)`,
        opacity: 0.3,
      }}
    />
  );
}

export function ScanLine() {
  return (
    <motion.div
      className="absolute left-0 right-0 h-px pointer-events-none"
      style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.4), transparent)" }}
      animate={{ top: ["0%", "100%"] }}
      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
    />
  );
}

export function PulsingDot({ color, delay = 0 }: { color: string; delay?: number }) {
  return (
    <motion.span
      className={`inline-block w-3 h-3 rounded-full ${color}`}
      animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 2, repeat: Infinity, delay }}
    />
  );
}

export function AnimatedCounter({ value, suffix = "" }: { value: string; suffix?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="tabular-nums"
    >
      {value}{suffix}
    </motion.span>
  );
}

// ─── ScaledSlide ──────────────────────────────────────────────────────────

export function ScaledSlide({
  children,
  containerRef,
}: {
  children: React.ReactNode;
  containerRef?: React.RefObject<HTMLDivElement>;
}) {
  const [scale, setScale] = useState(1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef?.current ?? wrapperRef.current?.parentElement;
    if (!container) return;

    const onResize = () => {
      const rect = container.getBoundingClientRect();
      const s = Math.min(rect.width / 1920, rect.height / 1080);
      setScale(s);
    };

    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef]);

  return (
    <div ref={wrapperRef} className="absolute inset-0 overflow-hidden">
      <div
        className="absolute slide-content"
        style={{
          width: 1920,
          height: 1080,
          left: "50%",
          top: "50%",
          marginLeft: -960,
          marginTop: -540,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Layout Helpers ───────────────────────────────────────────────────────

export function SlideLayout({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full h-full bg-background text-foreground flex flex-col overflow-hidden relative ${className}`}
      style={{ width: 1920, height: 1080 }}
    >
      {children}
    </div>
  );
}

export function LogoMark() {
  return (
    <>
      <img src={logoHorizontalDark} alt="OpenEye" className="h-10 logo-dark" />
      <img src={logoHorizontal} alt="OpenEye" className="h-10 logo-light" />
    </>
  );
}

export function Diamond({ className = "" }: { className?: string }) {
  return <span className={`inline-block w-4 h-4 rotate-45 ${className}`} />;
}

export function SlideNumber({ n, total }: { n: number; total: number }) {
  return (
    <div className="absolute bottom-12 right-16 font-mono text-base text-muted-foreground tabular-nums">
      {n} / {total}
    </div>
  );
}
