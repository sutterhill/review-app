export interface MinimapSegment {
  count: number;
  kind: "addition" | "context" | "deletion";
  startLine: number;
}

export interface MinimapData {
  additions: number;
  deletions: number;
  newLineCount: number;
  segments: MinimapSegment[];
}

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(?<newStart>\d+)(?:,(?<newCount>\d+))? @@/u;

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
  let pending: MinimapSegment | null = null;
  let inHunk = false;

  const flush = (): void => {
    if (pending) {
      segments.push(pending);
      pending = null;
    }
  };

  const emit = (kind: MinimapSegment["kind"], line: number): void => {
    if (pending && pending.kind === kind && pending.startLine + pending.count === line) {
      pending.count += 1;
    } else {
      flush();
      pending = { count: 1, kind, startLine: line };
    }
  };

  for (const line of lines) {
    const headerMatch = HUNK_HEADER.exec(line);
    if (headerMatch?.groups) {
      flush();
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
      emit("addition", newLineCursor);
      maxNewLine = Math.max(maxNewLine, newLineCursor);
      newLineCursor += 1;
      continue;
    }

    if (line.startsWith("-")) {
      deletions += 1;
      emit("deletion", newLineCursor);
      continue;
    }

    if (line.startsWith(" ") || line.length === 0) {
      emit("context", newLineCursor);
      maxNewLine = Math.max(maxNewLine, newLineCursor);
      newLineCursor += 1;
    }
  }
  flush();

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
