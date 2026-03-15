import { useState } from "react";
import { docsContent, type DocBlock, type DocGroup } from "@/data/docsContent";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (non-HTTPS or permission denied)
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="font-mono text-[10px] uppercase tracking-widest text-terminal-muted hover:text-terminal-fg transition-colors"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CodeBlock({ block }: { block: DocBlock }) {
  return (
    <div className="bg-card rounded-outer border overflow-hidden">
      {block.filename && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {block.filename}
          </span>
          <CopyButton text={block.content || ""} />
        </div>
      )}
      {!block.filename && (
        <div className="flex justify-end px-4 py-2 border-b border-border">
          <CopyButton text={block.content || ""} />
        </div>
      )}
      <pre className="p-4 overflow-x-auto font-mono text-sm leading-relaxed text-terminal-green">
        <code>{block.content}</code>
      </pre>
    </div>
  );
}

function TableBlock({ block }: { block: DocBlock }) {
  if (!block.columns || !block.rows) return null;

  return (
    <div className="overflow-x-auto rounded-outer border border-foreground/[0.06]">
      <table className="w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-foreground/[0.06] bg-card">
            {block.columns.map((col) => (
              <th
                key={col}
                className="text-left px-4 py-2.5 text-xs uppercase tracking-widest text-muted-foreground font-medium"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-foreground/[0.04] last:border-0"
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-2.5 ${j === 0 ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NoteBlock({ block }: { block: DocBlock }) {
  const variantStyles = {
    info: "border-terminal-green/40 bg-terminal-green/[0.03]",
    warning: "border-terminal-amber/40 bg-terminal-amber/[0.03]",
    danger: "border-terminal-red/40 bg-terminal-red/[0.03]",
  };
  const variant = block.variant || "info";

  return (
    <div
      className={`border-l-2 pl-4 py-3 rounded-r-inner text-sm text-muted-foreground ${variantStyles[variant]}`}
    >
      {block.content}
    </div>
  );
}

function renderBlock(block: DocBlock, index: number) {
  switch (block.type) {
    case "heading":
      if (block.level === 3) {
        return (
          <h3
            key={index}
            className="text-lg font-semibold font-display mt-6 mb-2"
          >
            {block.content}
          </h3>
        );
      }
      return (
        <h2
          key={index}
          className="text-2xl font-semibold font-display mt-8 mb-3"
        >
          {block.content}
        </h2>
      );

    case "paragraph":
      return (
        <p key={index} className="text-muted-foreground leading-relaxed">
          {block.content}
        </p>
      );

    case "code":
      return <CodeBlock key={index} block={block} />;

    case "table":
      return <TableBlock key={index} block={block} />;

    case "list":
      return (
        <ul key={index} className="space-y-1.5">
          {block.items?.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-terminal-green mt-1.5 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      );

    case "note":
      return <NoteBlock key={index} block={block} />;

    default:
      return null;
  }
}

export function DocsContent() {
  return (
    <div className="space-y-16">
      {docsContent.map((group: DocGroup) =>
        group.sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="text-2xl font-semibold font-display mb-6 pb-3 border-b border-foreground/[0.06]">
              {section.title}
            </h2>
            <div className="space-y-4">
              {section.blocks.map((block, i) => renderBlock(block, i))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
