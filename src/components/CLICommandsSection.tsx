import { CommandCard } from "@/components/CommandCard";
import { commands } from "@/data/indexPageData";

export function CLICommandsSection() {
  return (
    <section id="cli" className="py-[15vh] px-4 bg-card">
      <div className="container max-w-6xl mx-auto">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
          CLI Reference
        </div>
        <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
          Plug-and-play CLI.
        </h2>
        <p className="text-muted-foreground mb-12 max-w-xl">
          Every capability accessible from the command line. Like ffmpeg for machine perception.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {commands.map((cmd) => (
            <CommandCard key={cmd.label} {...cmd} />
          ))}
        </div>
      </div>
    </section>
  );
}
