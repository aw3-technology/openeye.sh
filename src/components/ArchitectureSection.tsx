import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";

export function ArchitectureSection() {
  return (
    <section id="architecture" className="py-[15vh] px-4">
      <div className="container max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
              Architecture
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
              Six layers. One pipeline.
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              Camera feed → Vision → Scene Understanding → LLM Reasoning → Action Planning → Robot Execution. Modular, swappable, open.
            </p>
            <div className="space-y-3 font-mono text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-terminal-green" />
                Hardware-agnostic: USB, RTSP, video files
              </div>
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-terminal-green" />
                Model-agnostic: YOLOv8, Grounding DINO, SAM2, Depth Anything
              </div>
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-terminal-green" />
                Adapter-ready: 7 adapters + ONNX/TensorRT runtimes
              </div>
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-terminal-amber" />
                REST + gRPC endpoints for any downstream consumer
              </div>
            </div>
          </div>
          <ArchitectureDiagram />
        </div>
      </div>
    </section>
  );
}
