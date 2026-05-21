import type { LineRange } from "../../store/walkthrough/walkthrough-types";

export interface SnippetLine {
  content: string;
  kind: "addition" | "context" | "deletion";
  lineNumber: number;
}

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(?<newStart>\d+)(?:,\d+)? @@/u;

interface PatchLine {
  content: string;
  kind: "addition" | "context" | "deletion";
  lineNumber: number;
}

export const parsePatchLines = (patch: string): PatchLine[] => {
  if (patch.length === 0) return [];
  const lines = patch.split("\n");
  const result: PatchLine[] = [];
  let cursor = 0;
  let inHunk = false;
  for (const line of lines) {
    const header = HUNK_HEADER.exec(line);
    if (header?.groups) {
      cursor = Number.parseInt(header.groups.newStart ?? "1", 10);
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ")) continue;
    if (line.startsWith("+")) {
      result.push({ content: line.slice(1), kind: "addition", lineNumber: cursor });
      cursor += 1;
      continue;
    }
    if (line.startsWith("-")) {
      result.push({ content: line.slice(1), kind: "deletion", lineNumber: cursor });
      continue;
    }
    if (line.startsWith(" ") || line.length === 0) {
      const content = line.length === 0 ? "" : line.slice(1);
      result.push({ content, kind: "context", lineNumber: cursor });
      cursor += 1;
    }
  }
  return result;
};

export const extractSnippet = (
  patch: string,
  ranges: LineRange[],
  options: { maxLines?: number } = {},
): SnippetLine[] => {
  const maxLines = options.maxLines ?? 40;
  if (ranges.length === 0) return [];
  const lines = parsePatchLines(patch);
  if (lines.length === 0) return [];

  const collected: SnippetLine[] = [];
  const seen = new Set<string>();

  for (const range of ranges) {
    const [start, end] = range;
    for (const line of lines) {
      if (line.kind === "deletion") continue;
      if (line.lineNumber < start || line.lineNumber > end) continue;
      const key = `${line.lineNumber}-${line.kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      collected.push(line);
      if (collected.length >= maxLines) break;
    }
    if (collected.length >= maxLines) break;
  }

  collected.sort((a, b) => a.lineNumber - b.lineNumber);
  return collected;
};
