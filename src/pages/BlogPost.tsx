import { useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getBlogPost, formatDate } from "@/data/blogPosts";
import { categoryColors } from "@/data/categoryColors";
import { blogHeroImages } from "@/data/blogHeroImages";

function renderMarkdown(content: string) {
  const blocks: React.ReactNode[] = [];
  const lines = content.split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ``` only if it exists
      blocks.push(
        <div key={key++} className="my-6 rounded-outer overflow-hidden border border-foreground/[0.06]">
          {lang && (
            <div className="bg-foreground/[0.04] px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-foreground/[0.06]">
              {lang}
            </div>
          )}
          <pre className="bg-card p-4 overflow-x-auto">
            <code className="font-mono text-sm text-oe-green leading-relaxed">
              {codeLines.join("\n")}
            </code>
          </pre>
        </div>
      );
      continue;
    }

    // H2
    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={key++} className="text-2xl font-semibold font-display mt-12 mb-4">
          {line.slice(3)}
        </h2>
      );
      i++;
      continue;
    }

    // H3
    if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={key++} className="text-lg font-semibold font-display mt-8 mb-3">
          {line.slice(4)}
        </h3>
      );
      i++;
      continue;
    }

    // Unordered list items
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].trim() === "")) {
        if (lines[i].trim() === "") {
          // skip empty lines between items, but stop if next non-empty line isn't a list item
          const next = lines.slice(i + 1).find(l => l.trim() !== "");
          if (!next || !next.startsWith("- ")) break;
          i++;
          continue;
        }
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-4 space-y-2">
          {items.map((item, j) => (
            <li key={j} className="flex gap-3 text-muted-foreground leading-relaxed">
              <span className="text-terminal-green mt-1.5 shrink-0">&#x2022;</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list items
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && (/^\d+\.\s/.test(lines[i]) || lines[i].trim() === "")) {
        if (lines[i].trim() === "") {
          const next = lines.slice(i + 1).find(l => l.trim() !== "");
          if (!next || !/^\d+\.\s/.test(next)) break;
          i++;
          continue;
        }
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} className="my-4 space-y-2 list-none">
          {items.map((item, j) => (
            <li key={j} className="flex gap-3 text-muted-foreground leading-relaxed">
              <span className="font-mono text-sm text-terminal-amber shrink-0">{j + 1}.</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph
    blocks.push(
      <p key={key++} className="text-muted-foreground leading-relaxed my-4">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return blocks;
}

function renderInline(text: string): React.ReactNode {
  // Process bold, inline code, and links
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let k = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Inline code
    const codeMatch = remaining.match(/`(.+?)`/);

    let firstMatch: { type: string; match: RegExpMatchArray } | null = null;

    if (boldMatch && (!firstMatch || (boldMatch.index ?? Infinity) < (firstMatch.match.index ?? Infinity))) {
      firstMatch = { type: "bold", match: boldMatch };
    }
    if (codeMatch && (!firstMatch || (codeMatch.index ?? Infinity) < (firstMatch.match.index ?? Infinity))) {
      firstMatch = { type: "code", match: codeMatch };
    }

    if (!firstMatch) {
      parts.push(<span key={k++}>{remaining}</span>);
      break;
    }

    const idx = firstMatch.match.index ?? 0;
    if (idx > 0) {
      parts.push(<span key={k++}>{remaining.slice(0, idx)}</span>);
    }

    if (firstMatch.type === "bold") {
      parts.push(
        <strong key={k++} className="text-foreground font-medium">
          {firstMatch.match[1]}
        </strong>
      );
    } else if (firstMatch.type === "code") {
      parts.push(
        <code key={k++} className="font-mono text-sm bg-secondary text-oe-green px-1.5 py-0.5 rounded-inner break-all">
          {firstMatch.match[1]}
        </code>
      );
    }

    remaining = remaining.slice(idx + firstMatch.match[0].length);
  }

  return parts;
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPost(slug) : undefined;

  useEffect(() => {
    window.scrollTo(0, 0);
    if (post) {
      document.title = `${post.title} | OpenEye Blog`;
    }
  }, [slug, post]);

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <article className="pt-28 pb-24 px-4">
        <div className="container max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {/* Back link */}
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-8"
            >
              <span>&larr;</span>
              <span>All Posts</span>
            </Link>

            {/* Header */}
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border rounded-inner ${categoryColors[post.category] || "text-muted-foreground border-foreground/10"}`}>
                  {post.category}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-[2.75rem] font-semibold font-display leading-[1.1] mb-6">
                {post.title}
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                {post.excerpt}
              </p>
              <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground pb-8 border-b border-foreground/[0.06]">
                <span>{post.author}</span>
                <span className="text-foreground/10">|</span>
                <span>{formatDate(post.date)}</span>
                <span className="text-foreground/10">|</span>
                <span>{post.readTime}</span>
              </div>
            </div>

            {/* Content */}
            <div className="prose-openeye">
              {renderMarkdown(post.content)}
            </div>

            {/* Footer nav */}
            <div className="mt-16 pt-8 border-t border-foreground/[0.06]">
              <Link
                to="/blog"
                className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-terminal-green transition-colors"
              >
                <span>&larr;</span>
                <span>Back to all posts</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </article>

      <Footer />
    </div>
  );
}
