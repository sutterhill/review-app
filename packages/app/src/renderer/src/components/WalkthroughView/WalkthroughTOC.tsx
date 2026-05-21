import { cn } from "@/lib/utils";

export interface WalkthroughTOCEntry {
  heading: string;
  key: string;
}

interface WalkthroughTOCProps {
  activeKey: null | string;
  entries: WalkthroughTOCEntry[];
  onSelect: (key: string) => void;
}

export const WalkthroughTOC = ({
  activeKey,
  entries,
  onSelect,
}: WalkthroughTOCProps): React.JSX.Element => (
  <nav aria-label="Walkthrough contents" className="flex h-full flex-col">
    <div className="border-b px-5 py-4">
      <h2 className="text-[0.78rem] font-medium text-muted-foreground">Contents</h2>
    </div>
    <ol className="flex-1 overflow-y-auto px-2 py-3">
      {entries.length === 0 ? (
        <li className="px-3 py-2 text-[0.8rem] text-muted-foreground">No sections yet.</li>
      ) : null}
      {entries.map((entry, index) => {
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
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 break-words">{entry.heading || `Section ${index + 1}`}</span>
            </button>
          </li>
        );
      })}
    </ol>
  </nav>
);
