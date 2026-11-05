import { Link } from "react-router-dom";
import { docsContent, type DocGroup } from "@/data/docsContent";

interface DocsSidebarProps {
  activeId?: string;
  onSelect?: (id: string) => void;
}

function SidebarNav({ activeId, onSelect }: DocsSidebarProps) {
  return (
    <nav className="space-y-6">
      {docsContent.map((group: DocGroup) => (
        <div key={group.label}>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            {group.label}
          </div>
          <ul className="space-y-0.5">
            {group.sections.map((section) => (
              <li key={section.id}>
                <Link
                  to={`/docs/${section.id}`}
                  onClick={() => onSelect?.(section.id)}
                  aria-current={activeId === section.id ? "page" : undefined}
                  className={`block w-full text-left px-2 py-1.5 rounded-inner text-sm transition-colors ${
                    activeId === section.id
                      ? "text-terminal-green bg-terminal-green/5"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {section.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocsSidebar({ activeId, onSelect }: DocsSidebarProps) {
  return (
    <div className="sticky top-20 overflow-y-auto max-h-[calc(100vh-6rem)] scrollbar-thin pr-4">
      <SidebarNav activeId={activeId} onSelect={onSelect} />
    </div>
  );
}

export { SidebarNav };
