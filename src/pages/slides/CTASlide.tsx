import { motion } from "framer-motion";

import logoVertical from "@/assets/openeye-logo-vertical.png";
import logoVerticalDark from "@/assets/openeye-logo-vertical-dark.png";

import { SlideLayout, GridBackground, GlowOrb, ScanLine } from "./components";

export function CTASlide() {
  return (
    <SlideLayout>
      <GridBackground opacity={0.06} />
      <GlowOrb color="hsl(var(--oe-blue))" size={600} x="20%" y="30%" blur={280} />
      <GlowOrb color="hsl(var(--oe-red))" size={500} x="70%" y="50%" blur={250} />
      <GlowOrb color="hsl(var(--primary))" size={400} x="50%" y="10%" blur={220} />
      <ScanLine />

      <div className="flex-1 flex flex-col items-center justify-center px-20 relative z-10">
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <img src={logoVerticalDark} alt="OpenEye" className="h-48 logo-dark" />
          <img src={logoVertical} alt="OpenEye" className="h-48 logo-light" />
        </motion.div>
        <motion.h2
          className="text-[80px] font-semibold font-display leading-[1.05] text-center mb-10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          The perception layer
          <br />
          is <span className="bg-gradient-to-r from-primary via-oe-blue to-oe-green bg-clip-text text-transparent">open.</span>
        </motion.h2>
        <motion.div
          className="space-y-6 text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="font-mono text-[28px] bg-card/80 text-oe-green px-10 py-5 rounded-xl border border-border/60 inline-block backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-oe-green/40 to-transparent" />
            pip install openeye-sh
          </div>
        </motion.div>
        <motion.div
          className="flex items-center gap-10 font-mono text-2xl text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <span>github.com/aw3-technology/openeye.sh</span>
          <span className="text-primary">&middot;</span>
          <span>Apache 2.0</span>
          <span className="text-primary">&middot;</span>
          <span>openeye.lovable.app</span>
        </motion.div>
      </div>
    </SlideLayout>
  );
}
