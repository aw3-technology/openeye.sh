import { motion } from "framer-motion";
import { ease } from "@/lib/motion";

interface DetectedObject {
  name: string;
  confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hazard?: boolean;
}

const objects: DetectedObject[] = [
  { name: "APPLE_01", confidence: 98.2, x: 15, y: 35, w: 18, h: 22, hazard: false },
  { name: "CUP_01", confidence: 91.4, x: 55, y: 28, w: 14, h: 26, hazard: false },
  { name: "KNIFE_01", confidence: 94.7, x: 38, y: 42, w: 22, h: 8, hazard: true },
  { name: "BOOK_01", confidence: 89.1, x: 72, y: 50, w: 20, h: 16, hazard: false },
];

export function VisionFrame() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, ease }}
      className="relative border border-primary/20 rounded-outer overflow-hidden"
      style={{ outline: "2px solid hsl(var(--oe-blue) / 0.15)" }}
    >
      {/* Simulated camera feed */}
      <div className="relative aspect-video bg-secondary">
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--oe-blue)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--oe-blue)) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Scan line */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="w-full h-px bg-primary/30 animate-scan-line" />
        </div>

        {/* Bounding boxes */}
        {objects.map((obj, i) => (
          <motion.div
            key={obj.name}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.1, duration: 0.2, ease }}
            className="absolute"
            style={{
              left: `${obj.x}%`,
              top: `${obj.y}%`,
              width: `${obj.w}%`,
              height: `${obj.h}%`,
            }}
          >
            <div
              className={`w-full h-full border-[0.5px] ${
                obj.hazard
                  ? "border-oe-red bg-oe-red/10"
                  : "border-oe-blue bg-oe-blue/10"
              }`}
            />
            <span
              className={`absolute -top-5 left-0 text-[10px] font-mono px-1.5 py-0.5 tabular-nums ${
                obj.hazard
                  ? "bg-oe-red text-primary-foreground"
                  : "bg-oe-blue text-primary-foreground"
              }`}
            >
              {obj.name} [{obj.confidence.toFixed(1)}%]
            </span>
            {/* Corner markers */}
            <div className={`absolute top-0 left-0 w-2 h-2 border-t border-l ${obj.hazard ? "border-oe-red" : "border-oe-blue"}`} />
            <div className={`absolute top-0 right-0 w-2 h-2 border-t border-r ${obj.hazard ? "border-oe-red" : "border-oe-blue"}`} />
            <div className={`absolute bottom-0 left-0 w-2 h-2 border-b border-l ${obj.hazard ? "border-oe-red" : "border-oe-blue"}`} />
            <div className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r ${obj.hazard ? "border-oe-red" : "border-oe-blue"}`} />
          </motion.div>
        ))}

        {/* HUD overlay */}
        <div className="absolute top-3 left-3 font-mono text-[10px] text-primary/70 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rotate-45 bg-oe-blue" />
            OPENEYE v0.1.0
          </div>
          <div className="tabular-nums">FPS: 30 | RES: 1920×1080</div>
          <div className="tabular-nums">OBJECTS: {objects.length} | HAZARDS: {objects.filter(o => o.hazard).length}</div>
        </div>

        <div className="absolute bottom-3 right-3 font-mono text-[10px] text-oe-green/70">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-oe-green animate-pulse" />
            LIVE
          </div>
        </div>

        {/* Spatial relation line */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
          <line
            x1="49%"
            y1="46%"
            x2="24%"
            y2="46%"
            stroke="hsl(var(--oe-red))"
            strokeWidth="0.5"
            strokeDasharray="4 4"
            opacity="0.6"
          />
          <text x="36%" y="44%" fill="hsl(var(--oe-red))" fontSize="8" fontFamily="JetBrains Mono, monospace" opacity="0.8">
            2cm — HAZARD
          </text>
        </svg>
      </div>
    </motion.div>
  );
}
