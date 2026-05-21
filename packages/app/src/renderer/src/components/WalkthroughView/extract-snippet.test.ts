import { describe, expect, it } from "vitest";

import { extractSnippet, parsePatchLines } from "./extract-snippet";

describe("parsePatchLines", () => {
  it("returns empty array for empty patch", () => {
    expect(parsePatchLines("")).toEqual([]);
  });

  it("tracks line numbers across additions and context", () => {
    const patch = `@@ -1,3 +1,4 @@\n context-a\n+added-b\n context-c\n+added-d`;
    const lines = parsePatchLines(patch);
    expect(lines).toEqual([
      { content: "context-a", kind: "context", lineNumber: 1 },
      { content: "added-b", kind: "addition", lineNumber: 2 },
      { content: "context-c", kind: "context", lineNumber: 3 },
      { content: "added-d", kind: "addition", lineNumber: 4 },
    ]);
  });

  it("does not advance the cursor for deletions", () => {
    const patch = `@@ -1,2 +1,2 @@\n keep\n-gone\n+new`;
    const lines = parsePatchLines(patch);
    expect(lines).toEqual([
      { content: "keep", kind: "context", lineNumber: 1 },
      { content: "gone", kind: "deletion", lineNumber: 2 },
      { content: "new", kind: "addition", lineNumber: 2 },
    ]);
  });

  it("skips diff headers and out-of-hunk noise", () => {
    const patch = `diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n+only`;
    const lines = parsePatchLines(patch);
    expect(lines).toEqual([{ content: "only", kind: "addition", lineNumber: 1 }]);
  });
});

describe("extractSnippet", () => {
  const patch = `@@ -1,5 +1,6 @@\n a\n+b\n c\n+d\n e\n+f`;

  it("returns empty array when no ranges given", () => {
    expect(extractSnippet(patch, [])).toEqual([]);
  });

  it("returns lines whose lineNumber falls within any range", () => {
    const snippet = extractSnippet(patch, [[2, 4]]);
    expect(snippet.map((line) => line.lineNumber)).toEqual([2, 3, 4]);
  });

  it("skips deletion lines", () => {
    const deletionPatch = `@@ -1,3 +1,1 @@\n-a\n-b\n+c`;
    const snippet = extractSnippet(deletionPatch, [[1, 5]]);
    expect(snippet.every((line) => line.kind !== "deletion")).toBe(true);
  });

  it("merges multiple ranges without duplicates", () => {
    const snippet = extractSnippet(patch, [
      [1, 2],
      [2, 3],
    ]);
    const numbers = snippet.map((line) => line.lineNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("respects maxLines cap", () => {
    const big = `@@ -1,1 +1,10 @@\n+1\n+2\n+3\n+4\n+5\n+6\n+7\n+8\n+9\n+10`;
    const snippet = extractSnippet(big, [[1, 10]], { maxLines: 3 });
    expect(snippet).toHaveLength(3);
  });
});
