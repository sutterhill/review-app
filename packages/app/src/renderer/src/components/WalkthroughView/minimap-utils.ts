export interface MinimapSegment {
  count: number;
  id: string;
  kind: "addition" | "context" | "deletion";
  startLine: number;
  widthRatio: number;
}

export interface MinimapData {
  additions: number;
  deletions: number;
  newLineCount: number;
  segments: MinimapSegment[];
}

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(?<newStart>\d+)(?:,(?<newCount>\d+))? @@/u;
const MAX_VISUAL_LINE_LENGTH = 80;
const MIN_WIDTH_RATIO = 0.15;
const MAX_WIDTH_RATIO = 0.95;

const widthRatioForContent = (content: string): number => {
  const trimmed = content.replace(/\s+$/u, "");
  const visible = trimmed.length === 0 ? 1 : trimmed.length;
  const ratio = Math.min(visible, MAX_VISUAL_LINE_LENGTH) / MAX_VISUAL_LINE_LENGTH;
  return Math.max(MIN_WIDTH_RATIO, Math.min(MAX_WIDTH_RATIO, ratio));
};

export const parsePatchForMinimap = (patch: string): MinimapData => {
  if (patch.length === 0) {
    return { additions: 0, deletions: 0, newLineCount: 1, segments: [] };
  }
  const lines = patch.split("\n");
  const segments: MinimapSegment[] = [];
  let newLineCursor = 0;
  let maxNewLine = 0;
  let additions = 0;
  let deletions = 0;
  let inHunk = false;
  let nextSegmentId = 0;

  const emit = (kind: MinimapSegment["kind"], line: number, content: string): void => {
    nextSegmentId += 1;
    segments.push({
      count: 1,
      id: `seg-${nextSegmentId}`,
      kind,
      startLine: line,
      widthRatio: widthRatioForContent(content),
    });
  };

  for (const line of lines) {
    const headerMatch = HUNK_HEADER.exec(line);
    if (headerMatch?.groups) {
      newLineCursor = Number.parseInt(headerMatch.groups.newStart ?? "1", 10);
      const count = Number.parseInt(headerMatch.groups.newCount ?? "0", 10);
      maxNewLine = Math.max(maxNewLine, newLineCursor + count - 1);
      inHunk = true;
      continue;
    }

    if (!inHunk) continue;
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ")) continue;

    if (line.startsWith("+")) {
      additions += 1;
      emit("addition", newLineCursor, line.slice(1));
      maxNewLine = Math.max(maxNewLine, newLineCursor);
      newLineCursor += 1;
      continue;
    }

    if (line.startsWith("-")) {
      deletions += 1;
      emit("deletion", newLineCursor, line.slice(1));
      continue;
    }

    if (line.startsWith(" ") || line.length === 0) {
      emit("context", newLineCursor, line.length === 0 ? "" : line.slice(1));
      maxNewLine = Math.max(maxNewLine, newLineCursor);
      newLineCursor += 1;
    }
  }

  return {
    additions,
    deletions,
    newLineCount: Math.max(maxNewLine, 1),
    segments,
  };
};

export const overlapsRanges = (
  segment: MinimapSegment,
  ranges: ReadonlyArray<readonly [number, number]>,
): boolean => {
  const start = segment.startLine;
  const end = segment.startLine + segment.count - 1;
  return ranges.some(([low, high]) => start <= high && end >= low);
};
