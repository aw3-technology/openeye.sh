import { PageHero } from "@/components/PageHero";

export function HeroSection() {
  return (
    <PageHero eyebrow="About" title="Open-source eyes" accent="for every machine.">
      OpenEye is created by venture studio{" "}
      <a
        href="https://aw3.technology"
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        AW3 Technology
      </a>
      , building the open perception layer for robots and autonomous agents. We believe that as
      machines enter human spaces, the safety and vision systems they rely on must be transparent,
      inspectable, and community-owned.
    </PageHero>
  );
}
