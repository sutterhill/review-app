import { PatchDiff } from "@pierre/diffs/react";
import { Check } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import type { PullRequestFile } from "../../store/pr/pr-types";
import { SNIPPET_DIFF_OPTIONS } from "../diff-utils";

interface FileDiffPanelProps {
  file: PullRequestFile;
  isViewed?: boolean;
  onOpen: (path: string) => void;
  onToggleViewed?: (path: string, viewed: boolean) => void;
  patch: string;
}

const COLLAPSED_LINES = 20;

export const FileDiffPanel = ({
  file,
  isViewed = false,
  onOpen,
  onToggleViewed,
  patch,
}: FileDiffPanelProps): React.JSX.Element => {
  const [expanded, setExpanded] = useState(false);
  const fileName = file.filename.split("/").pop() ?? file.filename;
  const directory = file.filename
    .slice(0, file.filename.length - fileName.length)
    .replace(/\/$/, "");
  const totalLines = useMemo(() => countDiffRows(patch), [patch]);
  const overflows = totalLines > COLLAPSED_LINES;
  const hiddenCount = Math.max(totalLines - COLLAPSED_LINES, 0);
  const visiblePatch = useMemo(
    () => (expanded || !overflows ? patch : truncatePatch(patch, COLLAPSED_LINES)),
    [expanded, overflows, patch],
  );

  if (!patch) {
    return (
      <article className={cn("flex flex-col gap-2 rounded-md", isViewed && "opacity-60")}>
        <FileNameHeader
          directory={directory}
          file={file}
          fileName={fileName}
          isViewed={isViewed}
          onOpen={onOpen}
          onToggleViewed={onToggleViewed}
        />
        <p className="px-1 text-xs text-muted-foreground">No textual diff for this file.</p>
      </article>
    );
  }

  return (
    <article className={cn("flex flex-col gap-2 rounded-md", isViewed && "opacity-60")}>
      <FileNameHeader
        directory={directory}
        file={file}
        fileName={fileName}
        isViewed={isViewed}
        onOpen={onOpen}
        onToggleViewed={onToggleViewed}
      />
      <div className="relative overflow-hidden rounded-md border border-border/40">
        <PatchDiff options={SNIPPET_DIFF_OPTIONS} patch={visiblePatch} />
        {overflows ? (
          <button
            className="sticky bottom-0 left-0 z-[1] flex w-full items-center justify-center border-t border-border/40 bg-background/95 px-2 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm hover:text-foreground"
            onClick={() => setExpanded((value) => !value)}
            type="button"
          >
            {expanded ? "Show less" : `Show ${hiddenCount} more lines`}
          </button>
        ) : null}
      </div>
    </article>
  );
};

interface FileNameHeaderProps {
  directory: string;
  file: PullRequestFile;
  fileName: string;
  isViewed: boolean;
  onOpen: (path: string) => void;
  onToggleViewed?: (path: string, viewed: boolean) => void;
}

const FileNameHeader = ({
  directory,
  file,
  fileName,
  isViewed,
  onOpen,
  onToggleViewed,
}: FileNameHeaderProps): React.JSX.Element => (
  <div className="flex min-w-0 items-baseline gap-2 px-1">
    <button
      className="group flex min-w-0 flex-1 items-baseline gap-2 text-left"
      onClick={() => onOpen(file.filename)}
      type="button"
    >
      <span className="min-w-0 truncate font-mono text-[0.78rem] font-medium text-foreground group-hover:underline">
        {fileName}
      </span>
      {directory ? (
        <span className="min-w-0 truncate font-mono text-[0.7rem] text-muted-foreground">
          {directory}
        </span>
      ) : null}
    </button>
    <span className="flex shrink-0 items-center gap-2 text-[0.7rem]">
      <span className="text-emerald-600 dark:text-emerald-400">+{file.additions}</span>
      <span className="text-rose-600 dark:text-rose-400">-{file.deletions}</span>
      {onToggleViewed ? (
        <button
          aria-label={isViewed ? "Mark as unviewed" : "Mark as viewed"}
          aria-pressed={isViewed}
          className={cn(
            "ml-1 inline-flex size-4 items-center justify-center rounded-sm border text-muted-foreground transition-colors hover:text-foreground",
            isViewed
              ? "border-foreground/60 bg-foreground/10 text-foreground"
              : "border-border/60 bg-transparent",
          )}
          onClick={() => onToggleViewed(file.filename, !isViewed)}
          type="button"
        >
          {isViewed ? <Check className="size-3" /> : null}
        </button>
      ) : null}
    </span>
  </div>
);

const countDiffRows = (patch: string): number => {
  if (!patch) return 0;
  let total = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ")) continue;
    if (line.startsWith("@@")) total++;
    else if (line.length === 0) continue;
    else if (line[0] === "+" || line[0] === "-" || line[0] === " ") total++;
  }
  return total;
};

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/u;

const isHeaderLine = (line: string): boolean =>
  line.startsWith("diff ") ||
  line.startsWith("--- ") ||
  line.startsWith("+++ ") ||
  line.startsWith("index ") ||
  line.startsWith("new file mode") ||
  line.startsWith("deleted file mode") ||
  line.startsWith("old mode") ||
  line.startsWith("new mode") ||
  line.startsWith("similarity index") ||
  line.startsWith("dissimilarity index") ||
  line.startsWith("rename ") ||
  line.startsWith("copy ") ||
  line.startsWith("Binary ");

/**
 * Truncates a unified diff to at most `maxRows` change/context rows while
 * keeping the patch syntactically valid. We prefer to drop whole hunks, but
 * if the first hunk alone exceeds the budget we trim its body and rewrite
 * the `@@ -a,b +c,d @@` header to match the kept line counts so downstream
 * parsers (and Shiki via @pierre/diffs) still tokenize the file as code
 * rather than falling back to plain text on a malformed patch.
 */
const truncatePatch = (patch: string, maxRows: number): string => {
  if (!patch) return "";
  const lines = patch.split("\n");
  const fileHeader: string[] = [];
  const hunks: { header: string; body: string[] }[] = [];
  let current: { header: string; body: string[] } | null = null;
  for (const line of lines) {
    if (line.startsWith("@@")) {
      current = { header: line, body: [] };
      hunks.push(current);
    } else if (current) {
      current.body.push(line);
    } else if (isHeaderLine(line) || line.length === 0) {
      fileHeader.push(line);
    }
  }
  const out: string[] = [...fileHeader];
  let rowsUsed = 0;
  for (const hunk of hunks) {
    const bodyRows = hunk.body.filter(
      (line) => line[0] === "+" || line[0] === "-" || line[0] === " ",
    ).length;
    const budget = maxRows - rowsUsed;
    if (budget <= 1) break;
    if (bodyRows + 1 <= budget) {
      out.push(hunk.header, ...hunk.body);
      rowsUsed += bodyRows + 1;
      continue;
    }
    const keptBody: string[] = [];
    let oldKept = 0;
    let newKept = 0;
    let kept = 0;
    for (const line of hunk.body) {
      if (kept >= budget - 1) break;
      const tag = line[0];
      if (tag === "+") {
        keptBody.push(line);
        newKept++;
        kept++;
      } else if (tag === "-") {
        keptBody.push(line);
        oldKept++;
        kept++;
      } else if (tag === " ") {
        keptBody.push(line);
        oldKept++;
        newKept++;
        kept++;
      }
    }
    const match = HUNK_HEADER_RE.exec(hunk.header);
    let header = hunk.header;
    if (match) {
      const oldStart = match[1];
      const newStart = match[3];
      const trailing = match[5] ?? "";
      header = `@@ -${oldStart},${oldKept} +${newStart},${newKept} @@${trailing}`;
    }
    out.push(header, ...keptBody);
    rowsUsed += kept + 1;
    break;
  }
  return out.join("\n");
};
