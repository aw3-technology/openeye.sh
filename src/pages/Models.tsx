import { useEffect } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ModelCard } from "@/components/ModelCard";
import { modelGroups } from "@/data/modelsData";
import { HeroSection } from "@/pages/models/HeroSection";
import { StatsSection } from "@/pages/models/StatsSection";
import { ModelSwapSection } from "@/pages/models/ModelSwapSection";
import { AdapterSection } from "@/pages/models/AdapterSection";
import { BenchmarksSection } from "@/pages/models/BenchmarksSection";
import { ProductionModelsSection } from "@/pages/models/ProductionModelsSection";
import { FaqSection } from "@/pages/models/FaqSection";
import { CtaSection } from "@/pages/models/CtaSection";

const ease = [0.2, 0.8, 0.2, 1] as const;

export default function Models() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Models | OpenEye";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <HeroSection />
      <StatsSection />
      <ModelSwapSection />
      <AdapterSection />

      {/* Model Groups */}
      {modelGroups.map((group, gi) => (
        <section
          key={group.category}
          className={`py-[12vh] px-4 ${gi % 2 !== 0 ? "bg-card" : ""}`}
        >
          <div className="container max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, ease }}
            >
              <div
                className={`font-mono text-xs uppercase tracking-widest ${group.color} mb-4`}
              >
                {group.category}
              </div>
              <h2 className="text-3xl md:text-4xl font-semibold font-display mb-12">
                {group.heading}
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {group.models.map((model, i) => (
                <ModelCard key={model.name} model={model} index={i} />
              ))}
            </div>
          </div>
        </section>
      ))}

      <BenchmarksSection />
      <ProductionModelsSection />
      <FaqSection />
      <CtaSection />

      <Footer />
    </div>
  );
}
