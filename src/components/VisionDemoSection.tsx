import { VisionFrame } from "@/components/VisionFrame";
import { SceneGraph } from "@/components/SceneGraph";

export function VisionDemoSection() {
  return (
    <section id="demo" className="py-[15vh] px-4">
      <div className="container max-w-6xl mx-auto">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
          Perception Layer
        </div>
        <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
          See what the machine sees.
        </h2>
        <p className="text-muted-foreground mb-12 max-w-xl">
          Real-time object detection with spatial reasoning, hazard classification, and agent-ready structured outputs.
        </p>

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <VisionFrame />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <SceneGraph />
          </div>
        </div>
      </div>
    </section>
  );
}
