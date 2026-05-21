import { cn } from "@/lib/utils";

import type { PullRequestFile } from "../../store/pr/pr-types";
import type { LineRange } from "../../store/walkthrough/walkthrough-types";
import { FileDiffMinimap } from "./FileDiffMinimap";

interface FileMasonryCardProps {
  active: boolean;
  emphasizedRanges?: LineRange[];
  file: PullRequestFile;
  maxFileLines: number;
  onClick: (path: string) => void;
  relevant: boolean;
}

export const FileMasonryCard = ({
  active,
  emphasizedRanges,
  file,
  maxFileLines,
  onClick,
  relevant,
}: FileMasonryCardProps): React.JSX.Element => {
  const fileName = file.filename.split("/").pop() ?? file.filename;
  const fileLines = file.additions + file.deletions;

  return (
    <button
      aria-label={`Open ${file.filename} diff`}
      className={cn(
        "group relative flex flex-col gap-2 rounded-md bg-transparent p-1 text-left transition-colors",
        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        relevant && "bg-muted/50",
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
        <span
          className={cn(
            "min-w-0 truncate text-[0.78rem] font-medium",
            relevant ? "text-foreground" : "text-foreground/80",
          )}
        >
          {fileName}
        </span>
      </div>
    </button>
  );
};
