import { CheckIcon } from "@heroicons/react/16/solid";
import { PatchDiff } from "@pierre/diffs/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";

import { cn } from "@/lib/utils";

import { selectThreadsForFile } from "../../store/comments/comments-selectors";
import type { PullRequestFile } from "../../store/pr/pr-types";
import { CollapseChevron } from "../CollapseChevron";
import { CollapseContent } from "../CollapseContent";
import { AnnotatedPatchDiff } from "../Comments/AnnotatedPatchDiff";
import { CommentCategoryIconStack } from "../Comments/CommentCategoryIcon";
import { SNIPPET_DIFF_OPTIONS } from "../diff-utils";

interface FileDiffPanelProps {
  file: PullRequestFile;
  isViewed?: boolean;
  onOpen: (path: string) => void;
  onToggleViewed?: (path: string, viewed: boolean) => void;
  patch: string;
  prReference?: string;
}

const COLLAPSED_LINES = 20;

export const FileDiffPanel = ({
  file,
  isViewed = false,
  onOpen,
  onToggleViewed,
  patch,
  prReference,
}: FileDiffPanelProps): React.JSX.Element => {
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(isViewed);
  const articleRef = useRef<HTMLElement>(null);
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
  const maxVisibleNewLine = useMemo(
    () => (overflows && !expanded ? maxNewLineInPatch(visiblePatch) : Infinity),
    [overflows, expanded, visiblePatch],
  );
  const fileThreads = useSelector(selectThreadsForFile(prReference ?? "", file.filename));
  const hiddenThreadStackItems = useMemo(() => {
    if (!overflows || expanded || !prReference) return [];
    return fileThreads
      .filter((thread) => !thread.resolved && thread.lineRange[1] > maxVisibleNewLine)
      .map((thread) => ({
        category: thread.category ?? thread.comments[0]?.category,
        isGithub: thread.source === "github",
      }));
  }, [overflows, expanded, prReference, fileThreads, maxVisibleNewLine]);

  useEffect(() => {
    setCollapsed(isViewed);
  }, [isViewed]);

  const handleToggleViewed = useCallback(
    (filename: string, viewed: boolean) => {
      onToggleViewed?.(filename, viewed);
      setCollapsed(viewed);
      if (!viewed) return;
      setExpanded(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const panels = document.querySelectorAll<HTMLElement>("article[data-file-diff-panel]");
          const list = Array.from(panels);
          const idx = articleRef.current ? list.indexOf(articleRef.current) : -1;
          const next = idx >= 0 ? list[idx + 1] : null;
          if (!next) return;
          const stickyHeader = document.querySelector<HTMLElement>("[data-pr-sticky-header]");
          const offset = stickyHeader?.offsetHeight ?? 0;
          const rect = next.getBoundingClientRect();
          window.scrollTo({
            behavior: "smooth",
            top: window.scrollY + rect.top - offset - 60,
          });
        });
      });
    },
    [onToggleViewed],
  );

  const wrappedToggleViewed = onToggleViewed ? handleToggleViewed : undefined;
  const toggleCollapsed = useCallback(() => setCollapsed((value) => !value), []);

  if (!patch) {
    return (
      <article
        className={cn("flex flex-col gap-2 rounded-md", isViewed && "opacity-60")}
        data-file-diff-panel=""
        ref={articleRef}
        style={{ scrollMarginTop: "var(--pr-header-offset, 0px)" }}
      >
        <FileNameHeader
          collapsed={collapsed}
          directory={directory}
          file={file}
          fileName={fileName}
          isViewed={isViewed}
          onOpen={onOpen}
          onToggleCollapsed={toggleCollapsed}
          onToggleViewed={wrappedToggleViewed}
        />
        <CollapseContent collapsed={collapsed}>
          <p className="px-1 text-xs text-muted-foreground">No textual diff for this file.</p>
        </CollapseContent>
      </article>
    );
  }

  return (
    <article
      className={cn("relative flex flex-col gap-2 rounded-md", isViewed && "opacity-60")}
      data-file-diff-panel=""
      ref={articleRef}
      style={{ scrollMarginTop: "var(--pr-header-offset, 0px)" }}
    >
      <FileNameHeader
        collapsed={collapsed}
        directory={directory}
        file={file}
        fileName={fileName}
        isViewed={isViewed}
        onOpen={onOpen}
        onToggleCollapsed={toggleCollapsed}
        onToggleViewed={wrappedToggleViewed}
      />
      <CollapseContent collapsed={collapsed}>
        <div className="relative overflow-hidden rounded-xl border border-border bg-white pt-2 [container-type:inline-size]">
          {prReference ? (
            <AnnotatedPatchDiffForFile
              filePath={file.filename}
              options={SNIPPET_DIFF_OPTIONS}
              patch={visiblePatch}
              prReference={prReference}
            />
          ) : (
            <PatchDiff options={SNIPPET_DIFF_OPTIONS} patch={visiblePatch} />
          )}
        </div>
      </CollapseContent>
      {!collapsed && overflows ? (
        <button
          className="sticky bottom-0 left-0 z-10 -mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-b-xl bg-background/95 px-2 py-0.5 text-[0.7rem] text-muted-foreground backdrop-blur-sm hover:text-foreground"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          <span>{expanded ? "Show less" : `+ ${hiddenCount} more lines`}</span>
          {!expanded && hiddenThreadStackItems.length > 0 ? (
            <CommentCategoryIconStack items={hiddenThreadStackItems} />
          ) : null}
        </button>
      ) : null}
    </article>
  );
};

interface AnnotatedPatchDiffForFileProps {
  filePath: string;
  options: React.ComponentProps<typeof AnnotatedPatchDiff>["options"];
  patch: string;
  prReference: string;
}

const AnnotatedPatchDiffForFile = ({
  filePath,
  options,
  patch,
  prReference,
}: AnnotatedPatchDiffForFileProps): React.JSX.Element => {
  const threads = useSelector(selectThreadsForFile(prReference, filePath));
  return (
    <AnnotatedPatchDiff
      filePath={filePath}
      options={options}
      patch={patch}
      prReference={prReference}
      threads={threads}
    />
  );
};

interface FileNameHeaderProps {
  collapsed: boolean;
  directory: string;
  file: PullRequestFile;
  fileName: string;
  isViewed: boolean;
  onOpen: (path: string) => void;
  onToggleCollapsed: () => void;
  onToggleViewed?: (path: string, viewed: boolean) => void;
}

const FileNameHeader = ({
  collapsed,
  directory,
  file,
  fileName,
  isViewed,
  onOpen,
  onToggleCollapsed,
  onToggleViewed,
}: FileNameHeaderProps): React.JSX.Element => (
  <div
    className="sticky z-10 flex min-w-0 items-baseline gap-1 bg-background px-1 py-1"
    style={{ top: "var(--pr-header-offset, 0px)" }}
  >
    <button
      className="group flex min-w-0 flex-1 cursor-pointer items-baseline gap-2 text-left"
      onClick={() => onOpen(file.filename)}
      type="button"
    >
      <span className="min-w-0 truncate text-sm font-medium text-foreground group-hover:underline">
        {fileName}
      </span>
      {directory ? (
        <span className="min-w-0 truncate text-xs text-muted-foreground">{directory}</span>
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
            "ml-1 inline-flex size-4 cursor-pointer items-center justify-center rounded-sm border transition-colors",
            isViewed
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-transparent text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onToggleViewed(file.filename, !isViewed)}
          type="button"
        >
          {isViewed ? <CheckIcon className="size-3" /> : null}
        </button>
      ) : null}
      <button
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand file diff" : "Collapse file diff"}
        className="ml-1 inline-flex size-4 shrink-0 cursor-pointer items-center justify-center self-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
        onClick={onToggleCollapsed}
        type="button"
      >
        <CollapseChevron className="size-3.5" collapsed={collapsed} />
      </button>
    </span>
  </div>
);

const NEW_LINE_HUNK_HEADER_RE = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/u;

const maxNewLineInPatch = (patch: string): number => {
  if (!patch) return 0;
  let maxLine = 0;
  let current = 0;
  for (const line of patch.split("\n")) {
    const header = NEW_LINE_HUNK_HEADER_RE.exec(line);
    if (header) {
      current = Number(header[1]) - 1;
      continue;
    }
    const tag = line[0];
    if (tag === "+" || tag === " ") {
      current++;
      if (current > maxLine) maxLine = current;
    }
  }
  return maxLine;
};

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
