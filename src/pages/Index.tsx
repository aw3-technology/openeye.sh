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
          },
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "OpenEye",
            alternateName: "openeye-sh",
            description:
              "Open-source, CLI-first perception engine that turns raw video into structured world models for robots, VLA models, and autonomous agents.",
            url: "https://openeye.sh",
            applicationCategory: "DeveloperApplication",
            operatingSystem: "macOS, Linux, Windows",
            license: "https://opensource.org/licenses/MIT",
            downloadUrl: "https://pypi.org/project/openeye-sh/",
            installUrl: "https://openeye.sh/docs/installation",
            codeRepository: "https://github.com/aw3-technology/openeye.sh",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
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
