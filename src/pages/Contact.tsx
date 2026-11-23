import { PageHero } from "@/components/PageHero";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageMeta } from "@/components/seo/PageMeta";
import { GITHUB_URL } from "@/data/navigation";

const CONTACT_EMAIL = "contact@aw3.tech";

const channels = [
  {
    label: "Email",
    mono: CONTACT_EMAIL,
    description:
      "Billing, credits, API keys, partnerships, press, and anything about your account. Include the email you signed in with.",
    href: `mailto:${CONTACT_EMAIL}`,
    cta: "Send an email",
  },
  {
    label: "Bug reports",
    mono: "GitHub Issues",
    description:
      "Something broken in the CLI, the MCP server, or the hosted API? Open an issue with the command you ran and its output.",
    href: `${GITHUB_URL}/issues`,
    cta: "Open an issue",
  },
  {
    label: "Questions",
    mono: "GitHub Discussions",
    description: "How-to questions, model requests, and ideas. Answers there help the next person too.",
    href: `${GITHUB_URL}/discussions`,
    cta: "Start a discussion",
  },
];

export default function Contact() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageMeta
        title="Contact | OpenEye"
        description="Contact the OpenEye team: email contact@aw3.tech for billing, API keys and partnerships, or use GitHub for bugs and questions."
        path="/contact"
      />
      <Navbar />
      <main>
        <PageHero size="sm" eyebrow="Contact" title="Get in touch">
          OpenEye is built by AW3 Technology, Inc. Pick the channel that fits and we&apos;ll get back to you.
        </PageHero>
        <section className="pt-12 px-4 pb-20">
          <div className="container max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
            {channels.map((channel) => (
              <a
                key={channel.label}
                href={channel.href}
                {...(channel.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="block group rounded-outer focus-visible:ring-2 focus-visible:ring-primary outline-none"
              >
                <div className="border border-foreground/[0.06] rounded-outer p-6 h-full bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors flex flex-col">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
                    {channel.mono}
                  </div>
                  <h2 className="text-lg font-light font-display leading-snug mb-3 group-hover:text-primary transition-colors">
                    {channel.label}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">{channel.description}</p>
                  <span className="font-mono text-xs text-primary group-hover:underline underline-offset-4">
                    {channel.cta} &rarr;
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
