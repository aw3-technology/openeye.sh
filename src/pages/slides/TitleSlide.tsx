import { motion } from "framer-motion";

import logoVertical from "@/assets/openeye-logo-vertical.png";
import logoVerticalDark from "@/assets/openeye-logo-vertical-dark.png";

import { SlideLayout, GridBackground, GlowOrb, ScanLine } from "./components";

export function TitleSlide() {
  return (
    <SlideLayout>
      <GridBackground opacity={0.06} />
      <GlowOrb color="hsl(var(--oe-blue))" size={600} x="10%" y="-20%" blur={250} />
      <GlowOrb color="hsl(var(--oe-red))" size={400} x="70%" y="60%" blur={200} />
      <ScanLine />

      <div className="flex-1 flex flex-col items-center justify-center px-20 pt-16 relative z-10">
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <img src={logoVerticalDark} alt="OpenEye" className="h-64 logo-dark" />
          <img src={logoVertical} alt="OpenEye" className="h-64 logo-light" />
        </motion.div>
        <motion.h1
          className="text-[96px] font-semibold font-display leading-[1] text-center tracking-tight mb-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Open-source eyes for
          <br />
          <span
            className="bg-gradient-to-r from-primary to-oe-blue bg-clip-text text-transparent"
          >
            the agent era.
          </span>
        </motion.h1>
        <motion.p
          className="text-[32px] text-muted-foreground text-center max-w-[1200px] leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          A perception engine that turns raw video into structured world models
          for robots and autonomous agents.
        </motion.p>
      </div>
      <motion.div
        className="pb-12 text-center font-mono text-lg text-muted-foreground relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        github.com/aw3-technology/openeye.sh &nbsp;&middot;&nbsp; Apache 2.0
      </motion.div>
    </SlideLayout>
  );
}
