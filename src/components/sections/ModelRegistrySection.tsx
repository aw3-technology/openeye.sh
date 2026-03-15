import { motion } from "framer-motion";
import { ModelRegistry } from "@/components/ModelRegistry";
import { VisionFrame } from "@/components/VisionFrame";

export function ModelRegistrySection() {
  return (
    <section id="demo" className="py-[15vh] px-4">
      <div className="container max-w-6xl mx-auto">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
          Model Registry
        </div>
        <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
          Pull. Run. Swap. Repeat.
        </h2>
        <p className="text-muted-foreground mb-12 max-w-xl">
          Every model gets a unified interface. Swap YOLOv8 for GroundingDINO with one command. Stack models together. No config files, no boilerplate.
        </p>

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <VisionFrame />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <ModelRegistry />
          </div>
        </div>
      </div>
    </section>
  );
}
