import { cn } from "@/lib/utils";

interface StreamingLineProps {
  className?: string;
  fallback?: string;
  text: string;
}

export const StreamingLine = ({
  className,
  fallback = "Thinking…",
  text,
}: StreamingLineProps): React.JSX.Element => {
  const display = text.trim().length > 0 ? text : fallback;
  return (
    <div
      aria-live="polite"
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground italic",
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate">{display}</span>
      <span
        aria-hidden="true"
        className="inline-block h-3 w-px shrink-0 bg-current animate-caret-blink"
      />
    </div>
  );
};
