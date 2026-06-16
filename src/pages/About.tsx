import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageMeta } from "@/components/seo/PageMeta";
import { HeroSection } from "@/components/about/HeroSection";
import { MissionSection } from "@/components/about/MissionSection";
import { ValuesSection } from "@/components/about/ValuesSection";
import { TeamSection } from "@/components/about/TeamSection";
import { TimelineSection } from "@/components/about/TimelineSection";
import { CtaSection } from "@/components/about/CtaSection";

export default function About() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "About | OpenEye";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title="About OpenEye — Building open perception infrastructure"
        description="Meet the team behind OpenEye and learn why we are building open-source perception infrastructure for the next generation of robots and AI agents."
        path="/about"
      />
      <Navbar />
      <main>
      <HeroSection />
      <MissionSection />
      <ValuesSection />
      <TeamSection />
      <TimelineSection />
      <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
