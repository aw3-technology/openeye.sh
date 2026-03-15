import { CommandCard } from "@/components/CommandCard";

const commands = [
  { label: "Pull", command: "openeye pull groundingdino", description: "Download and configure any vision model from the registry. Handles weights, dependencies, and runtime setup automatically." },
  { label: "Run", command: "openeye run yolov8 image.jpg", description: "Run any pulled model on an image or video. Returns structured JSON with detections, depth maps, or segmentation masks." },
  { label: "Watch", command: "openeye watch --models yolov8,depth-anything", description: "Continuous perception on a live camera feed. Stack multiple models together. Hot-swap models without restarting." },
  { label: "Serve", command: "openeye serve smolvla --port 8000", description: "Expose any model as a REST API. Any robot controller or agent can hit the endpoint with a frame and get back actions." },
  { label: "Safety", command: "openeye watch --safety --alert-on-change", description: "Real-time anomaly detection. Monitors workspace state, flags unexpected changes, and halts connected agents." },
  { label: "List", command: "openeye list", description: "Browse the model registry. See available models, installed versions, sizes, and supported tasks (detection, depth, VLA)." },
];

export function CLISection() {
  return (
    <section id="cli" className="py-[15vh] px-4 bg-card">
      <div className="container max-w-6xl mx-auto">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
          CLI Reference
        </div>
        <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
          One command. Any model. Any camera.
        </h2>
        <p className="text-muted-foreground mb-12 max-w-xl">
          Like Ollama made LLMs one command, OpenEye makes vision AI one command.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {commands.map((cmd) => (
            <CommandCard key={cmd.label} {...cmd} />
          ))}
        </div>
      </div>
    </section>
  );
}
