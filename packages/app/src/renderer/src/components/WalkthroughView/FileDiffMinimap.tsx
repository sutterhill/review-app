import { useMemo } from "react";

import { cn } from "@/lib/utils";

import type { LineRange } from "../../store/walkthrough/walkthrough-types";
import { overlapsRanges, parsePatchForMinimap, type MinimapSegment } from "./minimap-utils";

interface FileDiffMinimapProps {
  active?: boolean;
  emphasizedRanges?: LineRange[];
  height?: number;
  patch: string;
}

const MIN_BAR_HEIGHT_PX = 6;

export const FileDiffMinimap = ({
  active = false,
  emphasizedRanges,
  height = 150,
  patch,
}: FileDiffMinimapProps): React.JSX.Element => {
  const data = useMemo(() => parsePatchForMinimap(patch), [patch]);
  const hasEmphasis = !!emphasizedRanges && emphasizedRanges.length > 0;

  return (
    <div
      aria-label={
        data.segments.length === 0
          ? "No diff content"
          : `Diff minimap: +${data.additions} -${data.deletions}`
      }
      className={cn(
        "relative w-full overflow-hidden rounded-[3px] bg-muted/30 transition-colors",
        active && "ring-[2.5px] ring-foreground ring-inset",
      )}
      style={{ height }}
    >
      {data.segments.length === 0 ? (
        <div className="flex h-full items-center justify-center text-[0.6rem] text-muted-foreground">
          no diff
        </div>
      ) : (
        data.segments
          .filter((segment) => segment.kind !== "context")
          .map((segment) => (
            <MinimapSegmentBar
              emphasized={hasEmphasis && overlapsRanges(segment, emphasizedRanges ?? [])}
              key={segment.id}
              minHeightPx={MIN_BAR_HEIGHT_PX}
              segment={segment}
              totalHeightPx={height}
              totalLines={data.newLineCount}
            />
          ))
      )}
    </div>
  );
};

interface MinimapSegmentBarProps {
  emphasized: boolean;
  minHeightPx: number;
  segment: MinimapSegment;
  totalHeightPx: number;
  totalLines: number;
}

const MinimapSegmentBar = ({
  emphasized,
  minHeightPx,
  segment,
  totalHeightPx,
  totalLines,
}: MinimapSegmentBarProps): React.JSX.Element => {
  const denom = Math.max(totalLines, 1);
  const topPx = (Math.max(segment.startLine - 1, 0) / denom) * totalHeightPx;
  const rawHeightPx = (Math.max(segment.count, 1) / denom) * totalHeightPx;
  const heightPx = Math.max(rawHeightPx, minHeightPx);
  const clampedTopPx = Math.min(topPx, Math.max(totalHeightPx - heightPx, 0));
  const colorClass =
    segment.kind === "addition"
      ? "bg-emerald-400 dark:bg-emerald-400/80"
      : "bg-rose-300 dark:bg-rose-400/70";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute inset-x-0",
        colorClass,
        emphasized && "ring-1 ring-primary ring-offset-1 ring-offset-background",
      )}
      style={{
        height: `${heightPx}px`,
        top: `${clampedTopPx}px`,
      }}
    />
  );
};
