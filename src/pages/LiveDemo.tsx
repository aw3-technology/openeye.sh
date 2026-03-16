import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ChevronRight } from "lucide-react";
import { tabs } from "@/components/live-demo/constants";
import { SafetyDemo } from "@/components/live-demo/SafetyDemo";
import { DetectionPlayground } from "@/components/live-demo/DetectionPlayground";
import { VLMReasoningDemo } from "@/components/live-demo/VLMReasoningDemo";
import { InteractiveCLI } from "@/components/live-demo/InteractiveCLI";

export default function LiveDemo() {
  const [activeTab, setActiveTab] = useState("safety");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-20 px-4">
        <div className="container max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center mb-16"
          >
            <div className="flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
              <span className="w-2 h-2 rotate-45 bg-oe-blue" />
              <span className="w-2 h-2 rotate-45 bg-oe-red" />
              <span className="w-2 h-2 rotate-45 bg-foreground" />
              <span className="ml-1">Live Demo</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold font-display leading-[1.05] mb-6">
              Try OpenEye. <span className="text-primary">Right now.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              No installation required. Watch the safety guardian in action, run object detection, explore VLM reasoning, or try the CLI — all simulated in your browser.
            </p>
          </motion.div>

          {/* Tab selector */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-xl border font-mono text-sm transition-all ${
                    activeTab === tab.id
                      ? "bg-primary/10 border-primary text-primary shadow-sm"
                      : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab description */}
          <AnimatePresence mode="wait">
            <motion.p
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-center text-muted-foreground mb-10 max-w-xl mx-auto"
            >
              {tabs.find((t) => t.id === activeTab)?.description}
            </motion.p>
          </AnimatePresence>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              {activeTab === "safety" && <SafetyDemo />}
              {activeTab === "detect" && <DetectionPlayground />}
              {activeTab === "vlm" && <VLMReasoningDemo />}
              {activeTab === "terminal" && <InteractiveCLI />}
            </motion.div>
          </AnimatePresence>

          {/* Bottom CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-20 text-center"
          >
            <div className="bg-card border rounded-2xl p-10 max-w-2xl mx-auto">
              <h3 className="text-2xl font-semibold font-display mb-4">
                Ready to run it for real?
              </h3>
              <p className="text-muted-foreground mb-6">
                Install OpenEye and connect to your own cameras and robots.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <div className="font-mono text-sm bg-secondary text-oe-green px-5 py-2.5 rounded-lg border select-all cursor-text">
                  pipx install openeye-sh
                </div>
                <a
                  href="/docs"
                  className="font-mono text-sm bg-primary text-primary-foreground px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  Read the Docs <ChevronRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
