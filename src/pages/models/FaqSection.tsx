import { motion } from "framer-motion";
import { modelFaqs } from "@/data/modelsData";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const ease = [0.2, 0.8, 0.2, 1] as const;

export function FaqSection() {
  return (
    <section className="py-[12vh] px-4 border-t border-foreground/[0.06]">
      <div className="container max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, ease }}
          className="text-center mb-12"
        >
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            FAQ
          </div>
          <h2 className="text-3xl font-semibold font-display">
            Frequently asked questions
          </h2>
        </motion.div>

        <Accordion type="single" collapsible className="w-full">
          {modelFaqs.map((item, i) => (
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
  );
}
