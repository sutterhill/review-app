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

const BAR_HEIGHT_PX = 3;
const BAR_GAP_PX = 2;
const PADDING_X_PX = 10;
const PADDING_Y_PX = 10;

export const FileDiffMinimap = ({
  active = false,
  emphasizedRanges,
  height = 220,
  patch,
}: FileDiffMinimapProps): React.JSX.Element => {
  const data = useMemo(() => parsePatchForMinimap(patch), [patch]);
  const hasEmphasis = !!emphasizedRanges && emphasizedRanges.length > 0;
  const visibleSegments = data.segments.filter((segment) => segment.kind !== "context");
  const usableHeight = Math.max(height - PADDING_Y_PX * 2, BAR_HEIGHT_PX);
  const denom = Math.max(data.newLineCount, 1);
  const lineSlot = BAR_HEIGHT_PX + BAR_GAP_PX;

  return (
    <div
      aria-label={
        visibleSegments.length === 0
          ? "No diff content"
          : `Diff minimap: +${data.additions} -${data.deletions}`
      }
      className={cn(
        "relative w-full overflow-hidden rounded-[4px] border border-border/50 bg-card transition-colors",
        active && "border-foreground/80 shadow-[0_0_0_1px_var(--color-foreground)]",
      )}
      style={{ height }}
    >
      {visibleSegments.length === 0 ? (
        <div className="flex h-full items-center justify-center text-[0.6rem] text-muted-foreground">
          no diff
        </div>
      ) : (
        visibleSegments.map((segment) => (
          <MinimapSegmentBar
            emphasized={hasEmphasis && overlapsRanges(segment, emphasizedRanges ?? [])}
            key={segment.id}
            lineSlot={lineSlot}
            paddingX={PADDING_X_PX}
            paddingY={PADDING_Y_PX}
            segment={segment}
            totalLines={denom}
            usableHeight={usableHeight}
          />
        ))
      )}
    </div>
  );
};

interface MinimapSegmentBarProps {
  emphasized: boolean;
  lineSlot: number;
  paddingX: number;
  paddingY: number;
  segment: MinimapSegment;
  totalLines: number;
  usableHeight: number;
}

const MinimapSegmentBar = ({
  emphasized,
  lineSlot,
  paddingX,
  paddingY,
  segment,
  totalLines,
  usableHeight,
}: MinimapSegmentBarProps): React.JSX.Element => {
  const lineIndex = Math.max(segment.startLine - 1, 0);
  const positionalTop = (lineIndex / totalLines) * usableHeight;
  const slotTop = lineIndex * lineSlot;
  const topPx =
    paddingY +
    Math.min(Math.max(positionalTop, slotTop * 0.35), Math.max(usableHeight - BAR_HEIGHT_PX, 0));
  const widthPct = segment.widthRatio * 100;
  const colorClass =
    segment.kind === "addition"
      ? "bg-emerald-300/80 dark:bg-emerald-400/60"
      : "bg-rose-200 dark:bg-rose-400/60";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute rounded-[1px]",
        colorClass,
        emphasized && "ring-1 ring-primary ring-offset-1 ring-offset-background",
      )}
      style={{
        height: `${BAR_HEIGHT_PX}px`,
        left: `${paddingX}px`,
        top: `${topPx}px`,
        width: `${widthPct}%`,
        maxWidth: `calc(100% - ${paddingX * 2}px)`,
      }}
    />
  );
};
