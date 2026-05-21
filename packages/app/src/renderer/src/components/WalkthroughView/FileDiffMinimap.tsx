import { useMemo } from "react";

import { cn } from "@/lib/utils";

import type { LineRange } from "../../store/walkthrough/walkthrough-types";
import { overlapsRanges, parsePatchForMinimap, type MinimapSegment } from "./minimap-utils";

interface FileDiffMinimapProps {
  emphasizedRanges?: LineRange[];
  height?: number;
  patch: string;
}

const SEGMENT_GAP_PX = 1;
const MIN_SEGMENT_HEIGHT_PX = 2;

export const FileDiffMinimap = ({
  emphasizedRanges,
  height = 88,
  patch,
}: FileDiffMinimapProps): React.JSX.Element => {
  const data = useMemo(() => parsePatchForMinimap(patch), [patch]);
  const hasEmphasis = !!emphasizedRanges && emphasizedRanges.length > 0;

  if (data.segments.length === 0) {
    return (
      <div
        aria-label="No diff content"
        className="flex items-center justify-center rounded-sm bg-muted/50 text-[0.6rem] text-muted-foreground"
        style={{ height }}
      >
        no diff
      </div>
    );
  }

  return (
    <div
      aria-label={`Diff minimap: +${data.additions} -${data.deletions}`}
      className="relative flex flex-col gap-px"
      style={{ height }}
    >
      {data.segments.map((segment) => (
        <MinimapSegmentBar
          emphasized={hasEmphasis && overlapsRanges(segment, emphasizedRanges ?? [])}
          key={`${segment.kind}-${segment.startLine}-${segment.count}`}
          segment={segment}
          totalLines={data.newLineCount}
          totalSegments={data.segments.length}
        />
      ))}
    </div>
  );
};

interface MinimapSegmentBarProps {
  emphasized: boolean;
  segment: MinimapSegment;
  totalLines: number;
  totalSegments: number;
}

const MinimapSegmentBar = ({
  emphasized,
  segment,
  totalLines,
  totalSegments,
}: MinimapSegmentBarProps): React.JSX.Element => {
  const proportion = segment.count / Math.max(totalLines, 1);
  const flexGrow = Math.max(proportion, 1 / Math.max(totalSegments * 4, 8));
  const isContext = segment.kind === "context";
  const colorClass =
    segment.kind === "addition"
      ? "bg-emerald-500/80 dark:bg-emerald-400/70"
      : segment.kind === "deletion"
        ? "bg-rose-500/80 dark:bg-rose-400/70"
        : "bg-muted-foreground/20";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "w-full rounded-[1.5px] transition-opacity",
        colorClass,
        isContext ? "opacity-60" : "opacity-100",
        emphasized && "ring-1 ring-primary ring-offset-1 ring-offset-background",
      )}
      style={{
        flexGrow,
        flexShrink: 0,
        marginBottom: SEGMENT_GAP_PX,
        minHeight: MIN_SEGMENT_HEIGHT_PX,
      }}
    />
  );
};
