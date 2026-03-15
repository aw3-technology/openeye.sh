import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/sections/HeroSection";
import { ModelRegistrySection } from "@/components/sections/ModelRegistrySection";
import { SafetyMonitorSection } from "@/components/sections/SafetyMonitorSection";
import { ArchitectureSection } from "@/components/sections/ArchitectureSection";
import { CLISection } from "@/components/sections/CLISection";
import { BuiltWithSection } from "@/components/sections/BuiltWithSection";
import { CTASection } from "@/components/sections/CTASection";
import { Footer } from "@/components/sections/Footer";

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <ModelRegistrySection />
      <SafetyMonitorSection />
      <ArchitectureSection />
      <CLISection />
      <BuiltWithSection />
      <CTASection />
      <Footer />
    </div>
  );
}
