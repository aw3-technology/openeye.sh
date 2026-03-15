import { motion } from "framer-motion";
import { Github, Linkedin } from "lucide-react";
import { team } from "@/data/aboutData";

const ease = [0.2, 0.8, 0.2, 1] as const;

export function TeamSection() {
  return (
    <section className="py-[12vh] px-4 bg-card">
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, ease }}
        >
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Team
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            The people behind OpenEye.
          </h2>
          <p className="text-muted-foreground mb-12 max-w-xl">
            We're a small team focused on building open infrastructure for
            robot perception. Contributions welcome.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {team.map((member, i) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.3,
                delay: 0.1 + i * 0.04,
                ease,
              }}
              className="border border-foreground/[0.06] rounded-outer p-6 bg-background/50"
            >
              <div className="w-12 h-12 rounded-full bg-foreground/[0.06] flex items-center justify-center mb-4">
                <span className="text-lg font-display font-semibold text-muted-foreground">
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
              </div>
              <div className="font-medium mb-1">{member.name}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                {member.role}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {member.bio}
              </p>
              <div className="flex items-center gap-3">
                {member.links.github && (
                  <a
                    href={member.links.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Github className="w-4 h-4" />
                  </a>
                )}
                {member.links.linkedin && (
                  <a
                    href={member.links.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                )}
              </div>
            </motion.div>
          ))}

          {/* Contributor CTA Card */}
          <motion.a
            href="https://github.com/openeye-ai"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.3,
              delay: 0.1 + team.length * 0.04,
              ease,
            }}
            className="group border border-dashed border-foreground/[0.1] rounded-outer p-6 bg-background/50 hover:bg-foreground/[0.02] transition-colors flex flex-col items-center justify-center text-center"
          >
            <div className="w-12 h-12 rounded-full bg-foreground/[0.04] flex items-center justify-center mb-4 group-hover:bg-foreground/[0.06] transition-colors">
              <span className="text-2xl text-muted-foreground">+</span>
            </div>
            <div className="font-medium mb-1 group-hover:text-terminal-green transition-colors">
              Contribute
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              OpenEye is open-source. Join us on GitHub to contribute code,
              report issues, or suggest features.
            </p>
          </motion.a>
        </div>
      </div>
    </section>
  );
}
