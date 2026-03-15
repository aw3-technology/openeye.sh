export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  author: string;
  category: string;
  readTime: string;
  heroImage?: string;
  content: string;
}

interface Frontmatter {
  title: string;
  excerpt: string;
  date: string;
  author: string;
  category: string;
  readTime: string;
  heroImage?: string;
}

function parseFrontmatter(raw: string): { meta: Frontmatter; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) throw new Error("Invalid frontmatter");

  const meta = {} as Record<string, string>;
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(": ");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 2).trim();
    // Strip surrounding quotes
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    meta[key] = val;
  }

  return { meta: meta as unknown as Frontmatter, content: match[2].trimEnd() };
}

const mdFiles = import.meta.glob<string>("../content/blog/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

export const blogPosts: BlogPost[] = Object.entries(mdFiles)
  .map(([path, raw]) => {
    const slug = path.split("/").pop()!.replace(/\.md$/, "");
    const { meta, content } = parseFrontmatter(raw);
    return { slug, ...meta, content };
  })
  .sort((a, b) => (a.date > b.date ? -1 : 1));

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find(post => post.slug === slug);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
