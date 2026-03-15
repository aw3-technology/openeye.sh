import { usePageMeta } from "@/hooks/usePageMeta";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { HeroSection } from "@/components/about/HeroSection";
import { MissionSection } from "@/components/about/MissionSection";
import { ValuesSection } from "@/components/about/ValuesSection";
import { TeamSection } from "@/components/about/TeamSection";
import { TimelineSection } from "@/components/about/TimelineSection";
import { CtaSection } from "@/components/about/CtaSection";

export default function About() {
  usePageMeta("About");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <MissionSection />
      <ValuesSection />
      <TeamSection />
      <TimelineSection />
      <CtaSection />
      <Footer />
    </div>
  );
}
