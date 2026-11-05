import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { parseInline, type InlineNode } from "@/lib/markdown-inline";

const linkClass =
  "text-foreground underline decoration-primary/60 underline-offset-[3px] hover:decoration-primary transition-colors";

function renderNodes(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, i) => {
    switch (node.type) {
      case "text":
        return <Fragment key={i}>{node.value}</Fragment>;
      case "code":
        return (
          <code
            key={i}
            className="font-mono text-[0.85em] px-1.5 py-0.5 rounded-inner bg-foreground/[0.06] text-foreground break-words"
          >
            {node.value}
          </code>
        );
      case "strong":
        return (
          <strong key={i} className="font-semibold text-foreground">
            {renderNodes(node.children)}
          </strong>
        );
      case "em":
        return <em key={i}>{renderNodes(node.children)}</em>;
      case "link": {
        const children = renderNodes(node.children);
        // Same-site paths go through the router; external links open a new tab.
        if (node.href.startsWith("/")) {
          return (
            <Link key={i} to={node.href} className={linkClass}>
              {children}
            </Link>
          );
        }
        const external = /^https?:/i.test(node.href);
        return (
          <a
            key={i}
            href={node.href}
            className={linkClass}
            {...(external && { target: "_blank", rel: "noopener noreferrer" })}
          >
            {children}
          </a>
        );
      }
    }
  });
}

/** Renders a string of inline Markdown as React elements (no raw HTML). */
export function InlineMarkdown({ text }: { text?: string }) {
  if (!text) return null;
  return <>{renderNodes(parseInline(text))}</>;
}
