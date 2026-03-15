import { TerminalBlock } from "@/components/TerminalBlock";
import { planTerminalLines } from "@/data/indexPageData";

export function PerceptionLoopSection() {
  return (
    <section className="py-[15vh] px-4">
      <div className="container max-w-6xl mx-auto">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
          Agentic Perception Loop
        </div>
        <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
          Perceive. Reason. Act. Repeat.
        </h2>
        <p className="text-muted-foreground mb-12 max-w-xl">
          OpenEye doesn't just detect — it runs a continuous tick-based loop that perceives the scene, recalls memory, reasons with a VLM, and generates structured action plans for robots and agents.
        </p>

        <div className="max-w-2xl mx-auto">
          <TerminalBlock lines={planTerminalLines} title="openeye — agentic loop" />
        </div>
      </div>
    </section>
  );
}
