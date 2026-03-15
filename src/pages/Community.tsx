import { useEffect } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const channels = [
  {
    label: "Discord",
    description:
      "Join the community server. Ask questions, share projects, and get help from other developers.",
    href: "https://discord.gg/openeye",
    cta: "Join Discord",
    mono: "discord.gg/openeye",
  },
  {
    label: "GitHub Discussions",
    description:
      "Long-form conversations, RFCs, and feature requests. The best place for async technical discussion.",
    href: "https://github.com/aw3-technology/openeye.sh/discussions",
    cta: "Open Discussions",
    mono: "github.com/.../discussions",
  },
  {
    label: "Twitter / X",
    description:
      "Release announcements, demos, and quick updates. Follow for the latest.",
    href: "https://x.com/openeye_ai",
    cta: "Follow @openeye_ai",
    mono: "x.com/openeye_ai",
  },
];

const contributeSteps = [
  {
    step: "01",
    title: "Pick an issue",
    description:
      'Browse open issues labeled "good first issue" or "help wanted" on GitHub.',
  },
  {
    step: "02",
    title: "Fork & branch",
    description:
      "Fork the repo, create a feature branch, and set up your dev environment with one command.",
  },
  {
    step: "03",
    title: "Submit a PR",
    description:
      "Open a pull request. The CI will run tests and a maintainer will review within 48 hours.",
  },
];

export default function Community() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Community | OpenEye";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <section className="pt-28 pb-16 px-4">
        <div className="container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
              Community
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold font-display leading-[1.05] mb-4">
              Build with us.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
              OpenEye is open-source and community-driven. Whether you&apos;re
              reporting a bug, requesting a feature, or shipping a PR — you&apos;re
              part of this.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Channels */}
      <section className="px-4 pb-16">
        <div className="container max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {channels.map((channel, i) => (
              <motion.a
                key={channel.label}
                href={channel.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block group rounded-outer focus-visible:ring-2 focus-visible:ring-terminal-green outline-none"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: 0.1 + i * 0.05,
                  ease: [0.2, 0.8, 0.2, 1],
                }}
              >
                <div className="border border-foreground/[0.06] rounded-outer p-6 h-full bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors flex flex-col">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
                    {channel.mono}
                  </div>
                  <h3 className="text-lg font-semibold font-display leading-snug mb-3 group-hover:text-terminal-green transition-colors">
                    {channel.label}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">
                    {channel.description}
                  </p>
                  <span className="font-mono text-xs text-terminal-green group-hover:underline underline-offset-4">
                    {channel.cta} &rarr;
                  </span>
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* Adapter Plugin System */}
      <section className="px-4 pb-16">
        <div className="container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="border border-foreground/[0.06] rounded-outer p-8 md:p-12 bg-foreground/[0.02]">
              <div className="font-mono text-[10px] uppercase tracking-widest text-terminal-green mb-4">
                Adapter Plugin System
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold font-display leading-tight mb-4">
                Add a model. Never touch core code.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8 max-w-2xl">
                OpenEye&apos;s adapter system lets anyone contribute a new model, robot framework, or output format by implementing a single interface. Drop in a YOLO variant, plug in a ROS node, or wire up a custom robot controller — the core pipeline stays untouched.
              </p>

              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="space-y-2">
                  <div className="font-mono text-xs uppercase tracking-widest text-terminal-green">Model Adapters</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Add a new detection or segmentation model. Implement detect() and load(), register it — done. YOLO, DETR, SAM, or your own custom model.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="font-mono text-xs uppercase tracking-widest text-terminal-amber">Robot Adapters</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Connect OpenEye to any robot framework. Solo CLI, OpenClaw, and ROS 2 adapters ship built-in. Write yours in under 50 lines.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Output Adapters</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Stream perception data as JSON, protobuf, ROS messages, or your custom format. The output layer is pluggable too.
                  </p>
                </div>
              </div>

              <div className="bg-card rounded-inner border p-4 font-mono text-[13px] text-foreground overflow-x-auto">
                <div className="text-terminal-muted"># Example: Add a new model adapter</div>
                <div className="text-terminal-amber">from openeye.adapters import ModelAdapter</div>
                <div className="h-3" />
                <div className="text-terminal-green">class MyCustomModel(ModelAdapter):</div>
                <div className="text-terminal-fg pl-4">name = "my-model-v1"</div>
                <div className="h-3" />
                <div className="text-terminal-green pl-4">def load(self):</div>
                <div className="text-terminal-fg pl-8">self.model = load_weights("my-model.pt")</div>
                <div className="h-3" />
                <div className="text-terminal-green pl-4">def detect(self, frame):</div>
                <div className="text-terminal-fg pl-8">return self.model.predict(frame)</div>
                <div className="h-3" />
                <div className="text-terminal-muted"># Register it — now available via CLI and API</div>
                <div className="text-terminal-fg">openeye.register_adapter(MyCustomModel)</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contributing */}
      <section className="px-4 pb-16">
        <div className="container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="border border-foreground/[0.06] rounded-outer p-8 md:p-12 bg-foreground/[0.02]">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
                Contributing
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold font-display leading-tight mb-4">
                Start contributing in 3 steps.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8 max-w-2xl">
                We welcome contributions of all sizes — from typo fixes to major
                features. Check out the{" "}
                <a
                  href="https://github.com/openeye-ai/openeye/blob/main/CONTRIBUTING.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-terminal-green transition-colors underline underline-offset-4 decoration-foreground/20 rounded-sm focus-visible:ring-2 focus-visible:ring-terminal-green outline-none"
                >
                  contributor guide
                </a>{" "}
                for details.
              </p>

              <div className="grid md:grid-cols-3 gap-8">
                {contributeSteps.map((step) => (
                  <div key={step.step}>
                    <div className="font-mono text-2xl font-medium text-foreground/10 mb-3">
                      {step.step}
                    </div>
                    <h3 className="text-sm font-semibold font-display mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24">
        <div className="container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            className="text-center"
          >
            <a
              href="https://github.com/openeye-ai/openeye"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-foreground text-background px-6 py-3 rounded-inner font-mono text-xs uppercase tracking-widest hover:bg-foreground/90 transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-terminal-green focus-visible:ring-offset-2 focus-visible:ring-offset-background outline-none"
            >
              View on GitHub
            </a>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
