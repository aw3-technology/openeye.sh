import { usePageMeta } from "@/hooks/usePageMeta";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
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
import { FinalCTA } from "@/components/FinalCTA";

export default function Index() {
  usePageMeta("OpenEye | Open-Source Perception Engine", [], false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <VisionDemoSection />
      <SafetyGuardianSection />
      <PerceptionLoopSection />
      <ArchitectureSection />
      <TechEcosystem />
      <CodeExamples />
      <CLICommandsSection />
      <DemoVideo />
      <ProductionDashboardSection />
      <GetStarted />
      <DeployAnywhereSection />
      <BuiltWithSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}
