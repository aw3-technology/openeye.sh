import { useEffect } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  changelog,
  formatChangelogDate,
  changeTypeColors,
} from "@/data/changelog";

/** Parses backtick-delimited segments into inline <code> elements. */
function renderChangeText(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code
        key={i}
        className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5 rounded-inner text-foreground/80"
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

export default function Changelog() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Changelog | OpenEye";
  }, []);

  // Scroll to hash on mount — waits for framer-motion animations to settle
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    const idx = changelog.findIndex((e) => `v${e.version}` === hash);
    // Animation completes at: delay + duration. Last delay caps at 0.4, duration is 0.3.
    const animDone = idx >= 0 ? Math.min(0.1 + idx * 0.05, 0.4) + 0.3 : 0.3;
    const timer = setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, animDone * 1000 + 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <section className="pt-28 pb-12 px-4">
        <div className="container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
              Changelog
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold font-display leading-[1.05] mb-4">
              What&apos;s new in OpenEye.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Release history, breaking changes, and everything shipped. Follow
              along on{" "}
              <a
                href="https://github.com/openeye-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-terminal-green transition-colors underline underline-offset-4 decoration-foreground/20"
              >
                GitHub
              </a>{" "}
              for the full commit log.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Version index */}
      {changelog.length > 0 && (
        <section className="px-4 pb-10">
          <div className="container max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex flex-wrap gap-2"
            >
              {changelog.map((entry) => (
                <a
                  key={entry.version}
                  href={`#v${entry.version}`}
                  className="font-mono text-xs px-2.5 py-1 border border-foreground/[0.08] rounded-inner text-muted-foreground hover:text-terminal-green hover:border-terminal-green/20 transition-colors focus-visible:ring-2 focus-visible:ring-terminal-green outline-none"
                >
                  v{entry.version}
                </a>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Timeline */}
      <section className="px-4 pb-24">
        <div className="container max-w-6xl mx-auto">
          {changelog.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground font-mono text-sm">
              No releases yet.
            </div>
          ) : (
            <div className="space-y-8">
              {changelog.map((entry, i) => (
                <motion.div
                  key={entry.version}
                  id={`v${entry.version}`}
                  className="scroll-mt-24"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: Math.min(0.1 + i * 0.05, 0.4),
                    ease: [0.2, 0.8, 0.2, 1],
                  }}
                >
                  <div className="border border-foreground/[0.06] rounded-outer p-6 md:p-8 bg-foreground/[0.02]">
                    {/* Version header */}
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <a
                        href={`#v${entry.version}`}
                        className="font-mono text-sm font-medium text-foreground hover:text-terminal-green transition-colors"
                      >
                        v{entry.version}
                      </a>
                      {entry.tag === "latest" && (
                        <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border rounded-inner text-terminal-green border-terminal-green/20">
                          Latest
                        </span>
                      )}
                      {entry.tag === "breaking" && (
                        <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border rounded-inner text-terminal-amber border-terminal-amber/20">
                          Breaking
                        </span>
                      )}
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {formatChangelogDate(entry.date)}
                      </span>
                    </div>

                    <h2 className="text-xl font-semibold font-display leading-tight mb-2">
                      {entry.title}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-3xl">
                      {entry.description}
                    </p>

                    {/* Changes list */}
                    <div className="space-y-2">
                      {entry.changes.map((change, j) => (
                        <div key={j} className="flex items-start gap-3">
                          <span
                            className={`font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 border rounded-inner mt-0.5 shrink-0 ${changeTypeColors[change.type]}`}
                          >
                            {change.type}
                          </span>
                          <span className="text-sm text-muted-foreground leading-relaxed">
                            {renderChangeText(change.text)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
