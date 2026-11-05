import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageMeta } from "@/components/seo/PageMeta";
import { JsonLd } from "@/components/seo/JsonLd";
import { TechEcosystem } from "@/components/TechEcosystem";
import { CodeExamples } from "@/components/CodeExamples";
import { GetStarted } from "@/components/GetStarted";
import { DemoVideo } from "@/components/DemoVideo";
import { HeroSection } from "@/components/HeroSection";
import { ModelStrip } from "@/components/ModelStrip";
import { SafetyGuardianSection } from "@/components/SafetyGuardianSection";
import { PerceptionLoopSection } from "@/components/PerceptionLoopSection";
import { ArchitectureSection } from "@/components/ArchitectureSection";
import { CLICommandsSection } from "@/components/CLICommandsSection";
import { ProductionDashboardSection } from "@/components/ProductionDashboardSection";
import { DeployAnywhereSection } from "@/components/DeployAnywhereSection";
import { BuiltWithSection } from "@/components/BuiltWithSection";
import { UseCasesSection } from "@/components/UseCasesSection";
import { FinalCTA } from "@/components/FinalCTA";

export default function Index() {
  useEffect(() => {
    document.title = "OpenEye | Open-Source Perception Engine";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title="OpenEye — Open-Source Perception for Agents & Robots"
        description="OpenEye is a CLI-first perception engine that turns raw video into structured world models for robots, VLA models, and autonomous agents."
        path="/"
      />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "OpenEye",
            url: "https://openeye.sh",
            logo: "https://openeye.sh/favicon.ico",
            sameAs: ["https://github.com/aw3-technology/openeye.sh"],
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "OpenEye",
            url: "https://openeye.sh",
            potentialAction: {
              "@type": "SearchAction",
              target: "https://openeye.sh/docs?q={search_term_string}",
              "query-input": "required name=search_term_string",
            },
          },
        ]}
      />
      <Navbar />
      <main className="px-0 sm:px-4">
        <div className="oe-frame">
          <HeroSection />
          <div className="oe-rule">
            <ModelStrip />
          </div>
          <div className="oe-rule"><SafetyGuardianSection /></div>
          <div className="oe-rule"><PerceptionLoopSection /></div>
          <div className="oe-rule"><ArchitectureSection /></div>
          <div className="oe-rule"><TechEcosystem /></div>
          <div className="oe-rule"><CodeExamples /></div>
          <div className="oe-rule"><CLICommandsSection /></div>
          <div className="oe-rule"><DemoVideo /></div>
          <div className="oe-rule"><UseCasesSection /></div>
          <div className="oe-rule"><ProductionDashboardSection /></div>
          <div className="oe-rule"><GetStarted /></div>
          <div className="oe-rule"><DeployAnywhereSection /></div>
          <div className="oe-rule"><BuiltWithSection /></div>
          <div className="oe-rule"><FinalCTA /></div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
