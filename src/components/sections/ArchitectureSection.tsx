export function ArchitectureSection() {
  return (
    <section id="architecture" className="py-[15vh] px-4">
      <div className="container max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
              <span className="w-2 h-2 rotate-45 bg-oe-blue" />
              Architecture
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
              One CLI. Every vision model.
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              Model Registry → Unified Runtime → Camera Adapter → Structured Output → Agent Bus → Robot Execution. Modular, swappable, open.
            </p>
            <div className="space-y-3 font-mono text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rotate-45 bg-oe-blue" />
                Model-agnostic: YOLO26, YOLOv8, RF-DETR, DINO, SAM 2, Depth Anything, SmolVLA
              </div>
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rotate-45 bg-oe-blue" />
                Hardware-agnostic: USB, RTSP, video files, simulated feeds
              </div>
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rotate-45 bg-oe-green" />
                Agent-ready: Unitree G1, agentic loop, shared visual context
              </div>
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rotate-45 bg-oe-red" />
                Safety-first: anomaly detection, workspace monitoring, agent halt
              </div>
            </div>
          </div>
          <ArchitectureDiagram />
        </div>
      </div>
    </section>
  );
}

import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
