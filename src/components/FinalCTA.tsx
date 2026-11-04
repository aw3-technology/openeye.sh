import logoVertical from "@/assets/openeye-logo-vertical.png";
import logoVerticalDark from "@/assets/openeye-logo-vertical-dark.png";
import { InstallButton } from "@/components/InstallButton";

export function FinalCTA() {
  return (
    <section className="py-[15vh] px-4">
      <div className="container max-w-6xl mx-auto text-center">
        <img src={logoVerticalDark} alt="OpenEye" className="h-36 mx-auto mb-8 logo-dark" />
        <img src={logoVertical} alt="OpenEye" className="h-36 mx-auto mb-8 logo-light" />
        <h2 className="font-display text-4xl md:text-5xl font-light leading-[1.08] tracking-[-0.01em] mb-4">
          The perception layer is open.
        </h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Give your robots and agents the ability to see, understand, and act. Start building with OpenEye today.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="#get-started"
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
          >
            Get started
          </a>
          <InstallButton />
          <a
            href="https://github.com/aw3-technology/openeye.sh"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            Star on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
