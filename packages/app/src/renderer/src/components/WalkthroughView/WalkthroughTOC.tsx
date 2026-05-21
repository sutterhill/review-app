import { cn } from "@/lib/utils";

export interface WalkthroughTOCEntry {
  heading: string;
  key: string;
  number: number;
}

export interface WalkthroughTOCSection {
  entries: WalkthroughTOCEntry[];
  id: string;
  kind: "follow-up" | "initial";
  title: string;
}

interface WalkthroughTOCProps {
  activeKey: null | string;
  activeSectionId: null | string;
  onSelect: (key: string) => void;
  sections: WalkthroughTOCSection[];
}

export const WalkthroughTOC = ({
  activeKey,
  activeSectionId,
  onSelect,
  sections,
}: WalkthroughTOCProps): React.JSX.Element => (
  <nav aria-label="Walkthrough contents" className="flex h-full flex-col">
    <div className="border-b px-5 py-4">
      <h2 className="text-[0.78rem] font-medium text-muted-foreground">Contents</h2>
    </div>
    <div className="flex-1 overflow-y-auto py-2">
      {sections.length === 0 ? (
        <p className="px-5 py-2 text-[0.8rem] text-muted-foreground">No sections yet.</p>
      ) : null}
      {sections.map((section) => {
        const isActive = section.id === activeSectionId;
        const firstKey = section.entries[0]?.key;
        return (
          <section
            aria-current={isActive ? "true" : undefined}
            className="border-b last:border-b-0"
            key={section.id}
          >
            <button
              aria-expanded={isActive}
              className={cn(
                "flex w-full cursor-pointer flex-col items-start gap-0.5 px-5 py-3 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                isActive ? "bg-muted/40" : "hover:bg-muted/30",
              )}
              onClick={() => {
                if (firstKey) onSelect(firstKey);
              }}
              type="button"
            >
              <span className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                {section.kind === "follow-up" ? "Follow-up" : "Walkthrough"}
              </span>
              <span
                className={cn(
                  "text-[0.85rem] leading-snug",
                  isActive ? "font-medium text-foreground" : "text-foreground/80",
                )}
              >
                {section.title}
              </span>
            </button>
            {isActive ? (
              <ol className="px-2 pt-1 pb-3">
                {section.entries.length === 0 ? (
                  <li className="px-3 py-2 text-[0.8rem] text-muted-foreground">
                    No sections yet.
                  </li>
                ) : null}
                {section.entries.map((entry) => {
                  const active = entry.key === activeKey;
                  return (
                    <li key={entry.key}>
                      <button
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "group flex w-full cursor-pointer items-baseline gap-3 rounded-md px-3 py-2 text-left text-[0.85rem] leading-snug font-light transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                          active
                            ? "bg-muted text-foreground font-normal"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                        onClick={() => onSelect(entry.key)}
                        type="button"
                      >
                        <span
                          className={cn(
                            "shrink-0 tabular-nums text-[0.72rem]",
                            active ? "text-foreground/80" : "text-muted-foreground/60",
                          )}
                        >
                          {String(entry.number).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 break-words">
                          {entry.heading || `Section ${entry.number}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </section>
        );
      })}
    </div>
  </nav>
);
