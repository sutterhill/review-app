import { useMemo } from "react";

import type { LineRange } from "../../store/walkthrough/walkthrough-types";
import { parsePatchForMinimap, type MinimapSegment } from "./minimap-utils";

interface FileDiffMinimapProps {
  active?: boolean;
  emphasizedRanges?: LineRange[];
  fileLines: number;
  maxFileLines: number;
  patch: string;
}

const WIDTH_PX = 150;
const MAX_HEIGHT_PX = 300;
const MIN_HEIGHT_PX = 36;
const BAR_HEIGHT_PX = 3;
const BAR_GAP_PX = 2;
const PADDING_X_PX = 6;
const PADDING_Y_PX = 6;
const ADDITION_COLOR = "#A7E0A4";
const DELETION_COLOR = "#F5BDB6";

export const FileDiffMinimap = ({
  fileLines,
  maxFileLines,
  patch,
}: FileDiffMinimapProps): React.JSX.Element => {
  const data = useMemo(() => parsePatchForMinimap(patch), [patch]);
  const visibleSegments = data.segments.filter((segment) => segment.kind !== "context");
  const ratio = maxFileLines > 0 ? Math.min(fileLines / maxFileLines, 1) : 0;
  const height = Math.max(MIN_HEIGHT_PX, Math.round(ratio * MAX_HEIGHT_PX));
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
      className="relative overflow-hidden rounded-[4px] bg-card"
      style={{ height, width: WIDTH_PX }}
    >
      {visibleSegments.length === 0 ? (
        <div className="flex h-full items-center justify-center text-[0.6rem] text-muted-foreground">
          no diff
        </div>
      ) : (
        visibleSegments.map((segment) => (
          <MinimapSegmentBar
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
  lineSlot: number;
  paddingX: number;
  paddingY: number;
  segment: MinimapSegment;
  totalLines: number;
  usableHeight: number;
}

const MinimapSegmentBar = ({
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
  const color = segment.kind === "addition" ? ADDITION_COLOR : DELETION_COLOR;

  return (
    <div
      aria-hidden="true"
      className="absolute rounded-[1px]"
      style={{
        backgroundColor: color,
        height: `${BAR_HEIGHT_PX}px`,
        left: `${paddingX}px`,
        maxWidth: `calc(100% - ${paddingX * 2}px)`,
        top: `${topPx}px`,
        width: `${widthPct}%`,
      }}
    />
  );
};
