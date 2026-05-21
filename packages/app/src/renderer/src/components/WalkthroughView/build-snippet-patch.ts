import type { SnippetLine } from "./extract-snippet";

export const buildSnippetPatch = (path: string, lines: SnippetLine[]): string => {
  if (lines.length === 0) return "";
  const hunks: SnippetLine[][] = [];
  let current: SnippetLine[] = [];
  let previousLine = -1;
  for (const line of lines) {
    if (current.length === 0 || line.lineNumber <= previousLine + 1) {
      current.push(line);
    } else {
      hunks.push(current);
      current = [line];
    }
    previousLine = line.lineNumber;
  }
  if (current.length > 0) hunks.push(current);

  let output = `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n`;
  for (const hunk of hunks) {
    const first = hunk[0];
    if (!first) continue;
    const newStart = first.lineNumber;
    const newLen = hunk.length;
    const oldLen = hunk.filter((line) => line.kind === "context").length;
    const oldStart = oldLen === 0 ? Math.max(0, newStart - 1) : newStart;
    output += `@@ -${oldStart},${oldLen} +${newStart},${newLen} @@\n`;
    for (const line of hunk) {
      const prefix = line.kind === "addition" ? "+" : " ";
      output += `${prefix}${line.content}\n`;
    }
  }
  return output;
};
