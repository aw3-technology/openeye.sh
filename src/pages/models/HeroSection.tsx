import { PageHero } from "@/components/PageHero";

export function HeroSection() {
  return (
    <PageHero eyebrow="Supported models" title="Every model." accent="One interface.">
      OpenEye abstracts the vision layer so you can swap detection, segmentation, and reasoning
      models without changing application code. Use the best model for your use case.
    </PageHero>
  );
}
