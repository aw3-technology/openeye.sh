import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { blogPosts, formatDate } from "@/data/blogPosts";
import { categoryColors } from "@/data/categoryColors";
import { blogHeroImages } from "@/data/blogHeroImages";
import { ease } from "@/lib/motion";

export default function Blog() {
  usePageMeta("Blog");

  if (blogPosts.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-28 px-4 text-center">
          <p className="text-muted-foreground font-mono">No posts yet.</p>
        </div>
        <Footer />
      </div>
    );
  }

  const featured = blogPosts[0];
  const rest = blogPosts.slice(1);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="pt-28 pb-16 px-4">
        <div className="container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease }}
          >
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
              Blog
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold font-display leading-[1.05] mb-4">
              Thinking about perception.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Technical writing on robot perception, safety systems, open-source infrastructure, and the future of autonomous agents.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Featured Post */}
      <section className="px-4 pb-16">
        <div className="container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1, ease }}
          >
            <Link
              to={`/blog/${featured.slug}`}
              className="block group rounded-outer focus-visible:ring-2 focus-visible:ring-terminal-green outline-none"
            >
              <div className="border border-foreground/[0.06] rounded-outer overflow-hidden bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors">
                {blogHeroImages[featured.slug] && (
                  <div className="aspect-[21/9] overflow-hidden">
                    <img
                      src={blogHeroImages[featured.slug]}
                      alt={featured.title}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="p-8 md:p-12">
                <div className="flex items-center gap-3 mb-6">
                  <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border rounded-inner ${categoryColors[featured.category] || "text-muted-foreground border-foreground/10"}`}>
                    {featured.category}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Featured
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-semibold font-display leading-tight mb-4 group-hover:text-terminal-green transition-colors">
                  {featured.title}
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-6 max-w-3xl">
                  {featured.excerpt}
                </p>
                <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
                  <span>{formatDate(featured.date)}</span>
                  <span className="text-foreground/10">|</span>
                  <span>{featured.readTime}</span>
                </div>
              </div>
              </div>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Post Grid */}
      <section className="px-4 pb-24">
        <div className="container max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((post, i) => (
              <motion.div
                key={post.slug}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: Math.min(0.15 + i * 0.04, 0.5),
                  ease,
                }}
              >
                <Link
                  to={`/blog/${post.slug}`}
                  className="block group h-full rounded-outer focus-visible:ring-2 focus-visible:ring-terminal-green outline-none"
                >
                  <div className="border border-foreground/[0.06] rounded-outer overflow-hidden h-full bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors flex flex-col">
                    {blogHeroImages[post.slug] && (
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={blogHeroImages[post.slug]}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border rounded-inner ${categoryColors[post.category] || "text-muted-foreground border-foreground/10"}`}>
                        {post.category}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold font-display leading-snug mb-3 group-hover:text-terminal-green transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center gap-4 font-mono text-[10px] text-muted-foreground mt-auto pt-4 border-t border-foreground/[0.04]">
                      <span>{formatDate(post.date)}</span>
                      <span className="text-foreground/10">|</span>
                      <span>{post.readTime}</span>
                    </div>
                    </div>
                    </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
