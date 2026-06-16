import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageMeta } from "@/components/seo/PageMeta";
import { TechEcosystem } from "@/components/TechEcosystem";
import { CodeExamples } from "@/components/CodeExamples";
import { GetStarted } from "@/components/GetStarted";
import { DemoVideo } from "@/components/DemoVideo";
import { HeroSection } from "@/components/HeroSection";
import { VisionDemoSection } from "@/components/VisionDemoSection";
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
      <Navbar />
      <main>
      <HeroSection />
      <VisionDemoSection />
      <SafetyGuardianSection />
      <PerceptionLoopSection />
      <ArchitectureSection />
      <TechEcosystem />
      <CodeExamples />
      <CLICommandsSection />
      <DemoVideo />
      <UseCasesSection />
      <ProductionDashboardSection />
      <GetStarted />
      <DeployAnywhereSection />
      <BuiltWithSection />
      <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
