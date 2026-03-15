import { TerminalBlock } from "@/components/TerminalBlock";

const safetyTerminalLines = [
  { text: "$ openeye watch --safety --alert-on-change", color: "green" as const },
  { text: "", color: "default" as const },
  { text: "[SAFETY] Monitoring workspace... baseline captured", color: "muted" as const },
  { text: "[SAFETY] ✓ Scene stable — 4 objects, 0 anomalies", color: "green" as const },
  { text: "", color: "default" as const },
  { text: "[ANOMALY] ⚠ Human hand detected in robot workspace", color: "red" as const },
  { text: "[SAFETY] → Sending HALT to robot controller", color: "red" as const },
  { text: "[AGENT] Task agent paused. Waiting for clearance...", color: "muted" as const },
  { text: "", color: "default" as const },
  { text: "[SAFETY] ✓ Hand withdrawn. Workspace clear.", color: "green" as const },
  { text: "[AGENT] Task agent resumed. Continuing step 3/5.", color: "green" as const },
];

export function SafetyMonitorSection() {
  return (
    <section className="py-[15vh] px-4 bg-card">
      <div className="container max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
          <span className="w-2 h-2 rotate-45 bg-oe-red" />
          Safety Monitor
        </div>
        <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
          The system that watches the robots.
        </h2>
        <p className="text-muted-foreground mb-12 max-w-xl">
          Real-time visual anomaly detection. OpenEye monitors the workspace, flags changes that shouldn't happen, and halts agents before damage occurs.
        </p>

        <div className="max-w-2xl mx-auto">
          <TerminalBlock lines={safetyTerminalLines} title="openeye — safety monitor" />
        </div>
      </div>
    </section>
  );
}
