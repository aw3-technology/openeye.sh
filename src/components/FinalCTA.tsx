import logoVertical from "@/assets/openeye-logo-vertical.png";
import logoVerticalDark from "@/assets/openeye-logo-vertical-dark.png";

export function FinalCTA() {
  return (
    <section className="py-[15vh] px-4 border-t border-foreground/[0.06]">
      <div className="container max-w-6xl mx-auto text-center">
        <img src={logoVerticalDark} alt="OpenEye" className="h-36 mx-auto mb-8 logo-dark" />
        <img src={logoVertical} alt="OpenEye" className="h-36 mx-auto mb-8 logo-light" />
        <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
          The perception layer is open.
        </h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Give your robots and agents the ability to see, understand, and act. Start building with OpenEye today.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="#get-started"
            className="font-mono text-sm bg-foreground text-background px-5 py-2.5 rounded-inner hover:bg-foreground/90 transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-foreground/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background outline-none"
          >
            Get Started
          </a>
          <div className="font-mono text-sm bg-secondary text-oe-green px-4 py-2.5 rounded-inner border select-all cursor-text">
            pip install openeye-ai
          </div>
          <a
            href="https://github.com/openeye-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm text-muted-foreground px-4 py-2.5 rounded-inner border border-foreground/[0.06] hover:text-foreground hover:border-foreground/10 transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-foreground/50 outline-none"
          >
            Star on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
