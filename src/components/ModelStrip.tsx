const models = [
  { name: "YOLO26", task: "detection" },
  { name: "RF-DETR", task: "detection" },
  { name: "Grounding DINO", task: "open vocabulary" },
  { name: "SAM 2", task: "segmentation" },
  { name: "Depth Anything", task: "depth" },
  { name: "SmolVLA", task: "actions" },
  { name: "Qwen2.5-VL", task: "reasoning" },
];

/** The models OpenEye runs, under the hero demo. */
export function ModelStrip() {
  return (
    <div className="grid md:grid-cols-[220px_1fr]">
      <p className="border-b border-foreground/[0.07] px-8 py-6 text-sm leading-snug text-muted-foreground md:border-b-0 md:border-r">
        Swap models without changing the code that reads the scene.
      </p>
      <ul className="flex flex-wrap items-baseline gap-x-8 gap-y-3 px-8 py-6">
        {models.map((m) => (
          <li key={m.name} className="flex items-baseline gap-1.5">
            <span className="font-display text-xl text-foreground/90">{m.name}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{m.task}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
