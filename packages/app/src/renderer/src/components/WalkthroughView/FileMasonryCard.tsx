import { cn } from "@/lib/utils";

import type { PullRequestFile } from "../../store/pr/pr-types";
import type { LineRange } from "../../store/walkthrough/walkthrough-types";
import { FileDiffMinimap } from "./FileDiffMinimap";

interface FileMasonryCardProps {
  active: boolean;
  dimmed: boolean;
  emphasizedRanges?: LineRange[];
  file: PullRequestFile;
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
  onClick,
}: FileMasonryCardProps): React.JSX.Element => {
  const fileName = file.filename.split("/").pop() ?? file.filename;
  const directory = file.filename
    .slice(0, file.filename.length - fileName.length)
    .replace(/\/$/, "");

  return (
    <button
      aria-label={`Open ${file.filename} diff`}
      className={cn(
        "group relative flex w-full flex-col gap-2 rounded-md border bg-card p-3 text-left shadow-sm transition-all",
        "hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active && "border-primary/60 ring-1 ring-primary/40",
        dimmed && "opacity-40 hover:opacity-100",
      )}
      onClick={() => onClick(file.filename)}
      type="button"
    >
      <FileDiffMinimap emphasizedRanges={emphasizedRanges} patch={file.patch} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn("size-1.5 shrink-0 rounded-full", statusDot[file.status])}
          />
          <span className="min-w-0 truncate font-mono text-[0.7rem] text-foreground">
            {fileName}
          </span>
        </div>
        {directory ? (
          <p className="truncate font-mono text-[0.6rem] text-muted-foreground">{directory}</p>
        ) : null}
        <div className="mt-0.5 flex items-center gap-2 text-[0.6rem] tabular-nums">
          <span className="text-emerald-600 dark:text-emerald-400">+{file.additions}</span>
          <span className="text-rose-600 dark:text-rose-400">-{file.deletions}</span>
        </div>
      </div>
    </button>
  );
};
