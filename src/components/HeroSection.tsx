import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { InstallButton } from "@/components/InstallButton";
import { DetectionField } from "@/components/DetectionField";
import { VisionFrame } from "@/components/VisionFrame";
import { SceneGraph } from "@/components/SceneGraph";

const highlights = [
  "8 open models",
  "Runs on your hardware",
  "REST + WebSocket",
  "MCP server built in",
  "Apache 2.0",
];

export function HeroSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden px-4 pt-32">
      <DetectionField />

      <div className="relative mx-auto max-w-3xl text-center">
        <a
          href="#perception-loop"
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] py-1 pl-1 pr-3 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <span className="rounded-full bg-primary px-2 py-0.5 font-medium text-primary-foreground">v0.2</span>
          Agent loop with observation memory
        </a>

        <h1 className="font-display text-5xl font-light leading-[1.04] tracking-[-0.015em] md:text-7xl">
          Open-source eyes
          <span className="block text-primary">for the agent era.</span>
        </h1>

        <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground">
          OpenEye turns camera frames into structured scenes that robots and agents can act on: objects, depth,
          relationships and hazards. Run it on your own hardware or call the hosted API.
        </p>

        <ul className="mx-auto mt-7 flex max-w-2xl flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {highlights.map((item) => (
            <li key={item} className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#get-started"
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_0_32px_-6px_hsl(var(--primary)/0.6)] transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
          >
            Get started
          </a>
          <InstallButton />
        </div>

        <p className="mt-5 font-mono text-xs text-muted-foreground/80">
          Free and open source · Python 3.12+ · Hosted API with pay-as-you-go credits
        </p>
      </div>

      <motion.div
        id="demo"
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative mx-auto mt-16 max-w-5xl scroll-mt-24"
      >
        <div
          aria-hidden="true"
          className="absolute -inset-x-10 -bottom-10 top-10 -z-10 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.16),transparent_65%)] blur-2xl"
        />
        <div className="overflow-hidden rounded-t-xl border border-b-0 border-foreground/10 bg-card/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 border-b border-foreground/[0.07] px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
            <span className="ml-3 font-mono text-xs text-muted-foreground">openeye watch --safety</span>
          </div>
          <div className="grid gap-4 p-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <VisionFrame />
            </div>
            <div className="lg:col-span-2">
              <SceneGraph />
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
