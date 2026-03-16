import logoVertical from "@/assets/openeye-logo-vertical.png";

export function CTASection() {
  return (
    <section className="py-[15vh] px-4 border-t border-foreground/[0.06]">
      <div className="container max-w-6xl mx-auto text-center">
        <img src={logoVertical} alt="OpenEye" className="h-24 mx-auto mb-8" />
        <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
          The model layer for physical AI.
        </h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Pull any vision model. Run it on any camera. Connect it to any robot. Start building with OpenEye today.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <div className="font-mono text-sm bg-card text-oe-green px-4 py-2.5 rounded-inner border border-foreground/[0.06]">
            pipx install openeye-sh
          </div>
          <a
            href="https://github.com/aw3-technology/openeye.sh"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm bg-primary text-primary-foreground px-4 py-2.5 rounded-inner hover:bg-primary/90 transition-colors active:scale-[0.98]"
          >
            Star on GitHub →
          </a>
        </div>
      </div>
    </section>
  );
}
