import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { pricingTiers, pricingFaq, type PricingPlanTier } from "@/data/pricingData";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function PricingCard({ tier }: { tier: PricingPlanTier }) {
  const isExternal =
    !tier.ctaHref.startsWith("/");

  return (
    <div
      className={`relative flex flex-col rounded-outer p-8 ${
        tier.highlighted
          ? "border-2 border-terminal-green/30 bg-terminal-green/[0.03]"
          : "border border-foreground/[0.06]"
      }`}
    >
      {tier.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-terminal-green text-background text-xs font-mono uppercase tracking-widest rounded-full">
          {tier.badge}
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-semibold font-display mb-1">{tier.name}</h3>
        <div className="text-2xl font-semibold font-display text-foreground mb-3">
          {tier.price}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {tier.description}
        </p>
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {tier.features.map((feature) => (
          <li
            key={feature.text}
            className={`flex items-start gap-2 text-sm ${
              feature.included
                ? "text-foreground"
                : "text-muted-foreground/50 line-through"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                feature.included ? "bg-terminal-green" : "bg-foreground/10"
              }`}
            />
            {feature.text}
          </li>
        ))}
      </ul>

      {isExternal ? (
        <a
          href={tier.ctaHref}
          className={`block text-center font-mono text-sm px-5 py-2.5 rounded-inner transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-foreground/50 outline-none ${
            tier.highlighted
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "border border-foreground/[0.06] text-foreground hover:bg-foreground/[0.03]"
          }`}
        >
          {tier.cta}
        </a>
      ) : (
        <Link
          to={tier.ctaHref}
          className={`block text-center font-mono text-sm px-5 py-2.5 rounded-inner transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-foreground/50 outline-none ${
            tier.highlighted
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "border border-foreground/[0.06] text-foreground hover:bg-foreground/[0.03]"
          }`}
        >
          {tier.cta}
        </Link>
      )}
    </div>
  );
}

export default function Pricing() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Pricing | OpenEye";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-16 px-4">
        <div className="container max-w-6xl mx-auto text-center">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Pricing
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold font-display mb-4">
            Open source. Self-hosted.
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Start with the free CLI. Hosted inference coming soon.
          </p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="pb-20 px-4">
        <div className="container max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {pricingTiers.map((tier) => (
              <PricingCard key={tier.name} tier={tier} />
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 border-t border-foreground/[0.06]">
        <div className="container max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
              FAQ
            </div>
            <h2 className="text-3xl font-semibold font-display">
              Frequently asked questions
            </h2>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {pricingFaq.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border-foreground/[0.06]"
              >
                <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 border-t border-foreground/[0.06]">
        <div className="container max-w-6xl mx-auto text-center">
          <h2 className="text-3xl font-semibold font-display mb-4">
            Ready to get started?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Install the CLI and start building with OpenEye in minutes.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/docs#installation"
              className="font-mono text-sm bg-foreground text-background px-5 py-2.5 rounded-inner hover:bg-foreground/90 transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-foreground/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background outline-none"
            >
              Read the Docs
            </Link>
            <div className="font-mono text-sm bg-terminal-bg text-terminal-green px-4 py-2.5 rounded-inner border border-foreground/5 select-all cursor-text">
              pip install openeye-ai
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
