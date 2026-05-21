import { useMemo } from "react";

import { cn } from "@/lib/utils";

import type { LineRange } from "../../store/walkthrough/walkthrough-types";
import { extractSnippet, type SnippetLine } from "./extract-snippet";

interface FileSnippetProps {
  lineRanges: LineRange[];
  onClick: () => void;
  patch: string;
  path: string;
}

export const FileSnippet = ({
  lineRanges,
  onClick,
  patch,
  path,
}: FileSnippetProps): React.JSX.Element => {
  const lines = useMemo(() => extractSnippet(patch, lineRanges), [patch, lineRanges]);
  const fileName = path.split("/").pop() ?? path;
  const gutterWidth = useMemo(() => {
    const maxLine = lines.reduce((max, line) => Math.max(max, line.lineNumber), 0);
    return Math.max(2, String(maxLine).length);
  }, [lines]);

  return (
    <button
      aria-label={`Open ${path}`}
      className="group flex w-full cursor-pointer flex-col gap-1.5 text-left"
      onClick={onClick}
      type="button"
    >
      <span className="text-[0.78rem] font-medium text-foreground group-hover:underline">
        {fileName}
      </span>
      {lines.length > 0 ? (
        <pre className="overflow-x-auto rounded-md border border-border/60 bg-muted/30 px-3 py-2.5 font-mono text-[0.72rem] leading-[1.55] text-foreground">
          {lines.map((line) => (
            <SnippetRow
              gutterWidth={gutterWidth}
              key={`${line.lineNumber}-${line.kind}`}
              line={line}
            />
          ))}
        </pre>
      ) : null}
    </button>
  );
};

interface SnippetRowProps {
  gutterWidth: number;
  line: SnippetLine;
}

const SnippetRow = ({ gutterWidth, line }: SnippetRowProps): React.JSX.Element => {
  const display = String(line.lineNumber).padStart(gutterWidth, " ");
  return (
    <div
      className={cn(
        "flex gap-3",
        line.kind === "addition" && "text-emerald-700 dark:text-emerald-300",
      )}
    >
      <span
        aria-hidden="true"
        className="shrink-0 select-none tabular-nums text-muted-foreground/70"
      >
        {display}
      </span>
      <span className="whitespace-pre">{line.content || " "}</span>
    </div>
  );
};
