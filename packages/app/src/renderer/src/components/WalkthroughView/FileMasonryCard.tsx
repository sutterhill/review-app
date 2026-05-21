import { cn } from "@/lib/utils";

import type { PullRequestFile } from "../../store/pr/pr-types";
import type { LineRange } from "../../store/walkthrough/walkthrough-types";
import { FileDiffMinimap } from "./FileDiffMinimap";

interface FileMasonryCardProps {
  active: boolean;
  dimmed: boolean;
  emphasizedRanges?: LineRange[];
  file: PullRequestFile;
  maxFileLines: number;
  onClick: (path: string) => void;
}

const statusDot: Record<PullRequestFile["status"], string> = {
  added: "bg-emerald-500",
  deleted: "bg-rose-500",
  modified: "bg-amber-500",
  renamed: "bg-violet-500",
};

export const FileMasonryCard = ({
  active,
  dimmed,
  emphasizedRanges,
  file,
  maxFileLines,
  onClick,
}: FileMasonryCardProps): React.JSX.Element => {
  const fileName = file.filename.split("/").pop() ?? file.filename;
  const directory = file.filename
    .slice(0, file.filename.length - fileName.length)
    .replace(/\/$/, "");
  const fileLines = file.additions + file.deletions;

  return (
    <button
      aria-label={`Open ${file.filename} diff`}
      className={cn(
        "group relative flex flex-col gap-2 rounded-md bg-transparent p-1 text-left transition-opacity",
        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        dimmed && "opacity-40 hover:opacity-100",
        active && "opacity-100",
      )}
      onClick={() => onClick(file.filename)}
      style={{ width: 150 }}
      type="button"
    >
      <FileDiffMinimap
        active={active}
        emphasizedRanges={emphasizedRanges}
        fileLines={fileLines}
        maxFileLines={maxFileLines}
        patch={file.patch}
      />
      <div className="flex min-w-0 flex-col gap-0.5 px-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn("size-1.5 shrink-0 rounded-full", statusDot[file.status])}
          />
          <span className="min-w-0 truncate font-mono text-[0.72rem] font-medium text-foreground">
            {fileName}
          </span>
        </div>
        {directory ? (
          <p className="truncate font-mono text-[0.62rem] text-muted-foreground">{directory}</p>
        ) : null}
        <div className="mt-0.5 flex items-center gap-2 font-mono text-[0.62rem] tabular-nums">
          <span className="text-emerald-600 dark:text-emerald-400">+{file.additions}</span>
          <span className="text-rose-500 dark:text-rose-400">-{file.deletions}</span>
        </div>
      </div>
    </button>
  );
};
