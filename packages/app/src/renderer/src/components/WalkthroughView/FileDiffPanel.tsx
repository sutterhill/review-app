import { PatchDiff, type PatchDiffProps } from "@pierre/diffs/react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import type { PullRequestFile } from "../../store/pr/pr-types";
import { DIFF_OPTIONS } from "../diff-utils";

interface FileDiffPanelProps {
  file: PullRequestFile;
  onOpen: (path: string) => void;
}

const COLLAPSED_LINES = 20;
const LINE_HEIGHT_PX = 20;

type SnippetOptions = NonNullable<PatchDiffProps<undefined>["options"]>;

const SNIPPET_DIFF_OPTIONS: SnippetOptions = {
  ...DIFF_OPTIONS,
  disableFileHeader: true,
  overflow: "scroll",
  stickyHeader: false,
};

export const FileDiffPanel = ({ file, onOpen }: FileDiffPanelProps): React.JSX.Element => {
  const [expanded, setExpanded] = useState(false);
  const fileName = file.filename.split("/").pop() ?? file.filename;
  const directory = file.filename
    .slice(0, file.filename.length - fileName.length)
    .replace(/\/$/, "");
  const fullPatch = useMemo(() => wrapPatch(file), [file]);
  const totalLines = useMemo(() => countDiffRows(file.patch), [file.patch]);
  const overflows = totalLines > COLLAPSED_LINES;
  const collapsedHeight = COLLAPSED_LINES * LINE_HEIGHT_PX;
  const hiddenCount = Math.max(totalLines - COLLAPSED_LINES, 0);

  if (!file.patch) {
    return (
      <article className="flex flex-col gap-2 rounded-md">
        <FileNameHeader directory={directory} fileName={fileName} file={file} onOpen={onOpen} />
        <p className="px-1 text-xs text-muted-foreground">No textual diff for this file.</p>
      </article>
    );
  }

  return (
    <article className="flex flex-col gap-2 rounded-md">
      <FileNameHeader directory={directory} fileName={fileName} file={file} onOpen={onOpen} />
      <div
        className={cn(
          "relative overflow-x-auto overflow-y-hidden whitespace-pre rounded-md border border-border/40",
          !expanded &&
            overflows &&
            "[mask-image:linear-gradient(to_bottom,black_calc(100%-2.5rem),transparent)]",
        )}
        style={{ maxHeight: expanded ? undefined : collapsedHeight }}
      >
        <PatchDiff options={SNIPPET_DIFF_OPTIONS} patch={fullPatch} />
      </div>
      {overflows ? (
        <button
          className="self-start px-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded ? "Show less" : `Show ${hiddenCount} more lines`}
        </button>
      ) : null}
    </article>
  );
};

interface FileNameHeaderProps {
  directory: string;
  file: PullRequestFile;
  fileName: string;
  onOpen: (path: string) => void;
}

const FileNameHeader = ({
  directory,
  file,
  fileName,
  onOpen,
}: FileNameHeaderProps): React.JSX.Element => (
  <button
    className="group flex min-w-0 items-baseline gap-2 px-1 text-left"
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
    <span className="ml-auto flex shrink-0 items-center gap-2 text-[0.7rem]">
      <span className="text-emerald-600 dark:text-emerald-400">+{file.additions}</span>
      <span className="text-rose-600 dark:text-rose-400">-{file.deletions}</span>
    </span>
  </button>
);

const wrapPatch = (file: PullRequestFile): string => {
  if (!file.patch) return "";
  const oldPath = file.previousFilename ?? file.filename;
  const oldHeader = file.status === "added" ? "--- /dev/null" : `--- a/${oldPath}`;
  const newHeader = file.status === "deleted" ? "+++ /dev/null" : `+++ b/${file.filename}`;
  return [`diff --git a/${oldPath} b/${file.filename}`, oldHeader, newHeader, file.patch].join(
    "\n",
  );
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
