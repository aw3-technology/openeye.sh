import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  pricingTiers,
  pricingFaq,
  competitorNames,
  competitorFeatures,
  type PricingPlanTier,
} from "@/data/pricingData";
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

function ComparisonCell({
  value,
  highlighted,
}: {
  value: string | boolean;
  highlighted?: boolean;
}) {
  if (value === true) {
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          highlighted ? "bg-terminal-green" : "bg-terminal-green/70"
        }`}
        aria-label="Yes"
      />
    );
  }
  if (value === false) {
    return (
      <span className="inline-block w-2 h-2 rounded-full bg-foreground/10" aria-label="No" />
    );
  }
  return (
    <span
      className={`text-xs font-mono ${
        highlighted ? "text-terminal-green" : "text-muted-foreground"
      }`}
    >
      {value}
    </span>
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

      {/* Competitor Matrix */}
      <section className="py-20 px-4 border-t border-foreground/[0.06]">
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
              Comparison
            </div>
            <h2 className="text-3xl font-semibold font-display mb-3">
              How OpenEye stacks up
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto text-sm">
              A side-by-side look at OpenEye versus proprietary vision AI platforms.
            </p>
          </div>

          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-foreground/[0.06]">
                  <th className="text-left py-3 pr-4 font-mono text-xs uppercase tracking-widest text-muted-foreground w-[200px]">
                    Feature
                  </th>
                  <th className="py-3 px-3 text-center font-mono text-xs uppercase tracking-widest text-terminal-green w-[100px]">
                    OpenEye
                  </th>
                  {competitorNames.map((name) => (
                    <th
                      key={name}
                      className="py-3 px-3 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground w-[100px]"
                    >
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {competitorFeatures.map((feature) => (
                  <tr
                    key={feature.label}
                    className="border-b border-foreground/[0.04] hover:bg-foreground/[0.02] transition-colors"
                  >
                    <td className="py-3 pr-4 font-medium">{feature.label}</td>
                    <td className="py-3 px-3 text-center">
                      <ComparisonCell value={feature.openeye} highlighted />
                    </td>
                    {competitorNames.map((name) => (
                      <td key={name} className="py-3 px-3 text-center">
                        <ComparisonCell value={feature.competitors[name]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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
            <div className="font-mono text-sm bg-secondary text-oe-green px-4 py-2.5 rounded-inner border select-all cursor-text">
              pip install openeye-sh
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
