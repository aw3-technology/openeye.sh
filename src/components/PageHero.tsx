import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DetectionField } from "@/components/DetectionField";

interface PageHeroProps {
  /** Short label shown as a pill above the title. */
  eyebrow: string;
  title: ReactNode;
  /** Optional second title line, set in brand blue (homepage style). */
  accent?: ReactNode;
  children?: ReactNode;
  /** "sm" for utility pages (legal, docs) — no detection field, smaller type. */
  size?: "default" | "sm";
  /** Render the title as a non-heading when the page has its own <h1>. */
  titleAs?: "h1" | "div";
}

/**
 * Centered page header shared by the marketing pages: eyebrow pill,
 * Newsreader light headline with an optional blue accent line, and the
 * detection-field background from the homepage hero.
 */
export function PageHero({ eyebrow, title, accent, children, size = "default", titleAs = "h1" }: PageHeroProps) {
  const reduceMotion = useReducedMotion();
  const Title = titleAs;
  const large = size === "default";

  return (
    <section
      className={`relative overflow-hidden border-b border-foreground/[0.07] px-4 ${large ? "pt-32 pb-20" : "pt-28 pb-12"}`}
    >
      {large && <DetectionField />}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.10),transparent_60%)]"
      />
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative mx-auto max-w-3xl text-center"
      >
        <div className="mb-7 inline-flex items-center rounded-full border border-foreground/10 bg-foreground/[0.03] px-3 py-1 text-xs text-muted-foreground">
          {eyebrow}
        </div>
        <Title
          className={`font-display font-light leading-[1.04] tracking-[-0.015em] ${large ? "text-5xl md:text-6xl" : "text-4xl md:text-5xl"}`}
        >
          {title}
          {accent && <span className="block text-primary">{accent}</span>}
        </Title>
        {children && (
          <div className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {children}
          </div>
        )}
      </motion.div>
    </section>
  );
}
