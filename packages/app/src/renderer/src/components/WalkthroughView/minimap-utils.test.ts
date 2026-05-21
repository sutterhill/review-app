import { describe, expect, it } from "vitest";

import { overlapsRanges, parsePatchForMinimap } from "./minimap-utils";

describe("parsePatchForMinimap", () => {
  it("returns empty data for empty patch", () => {
    expect(parsePatchForMinimap("")).toEqual({
      additions: 0,
      deletions: 0,
      newLineCount: 1,
      segments: [],
    });
  });

  it("counts additions and deletions", () => {
    const patch = `@@ -1,3 +1,4 @@\n line a\n-old\n+new\n+new2\n line b`;
    const data = parsePatchForMinimap(patch);
    expect(data.additions).toBe(2);
    expect(data.deletions).toBe(1);
    expect(data.segments.length).toBeGreaterThan(0);
    expect(data.segments.some((segment) => segment.kind === "addition")).toBe(true);
    expect(data.segments.some((segment) => segment.kind === "deletion")).toBe(true);
  });

  it("ignores diff header lines", () => {
    const patch = `diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n+only`;
    const data = parsePatchForMinimap(patch);
    expect(data.additions).toBe(1);
    expect(data.deletions).toBe(0);
  });

  it("emits one segment per added line", () => {
    const patch = `@@ -1,2 +1,4 @@\n+a\n+b\n+c`;
    const data = parsePatchForMinimap(patch);
    const additionSegments = data.segments.filter((segment) => segment.kind === "addition");
    expect(additionSegments).toHaveLength(3);
    expect(additionSegments.every((segment) => segment.count === 1)).toBe(true);
  });

  it("emits one segment per deleted line", () => {
    const patch = `@@ -1,3 +1,1 @@\n-a\n-b\n-c\n+kept`;
    const data = parsePatchForMinimap(patch);
    const deletionSegments = data.segments.filter((segment) => segment.kind === "deletion");
    expect(deletionSegments).toHaveLength(3);
    expect(deletionSegments.every((segment) => segment.count === 1)).toBe(true);
  });

  it("computes widthRatio from line content length within bounds", () => {
    const longLine = "x".repeat(200);
    const patch = `@@ -1 +1,2 @@\n+a\n+${longLine}`;
    const data = parsePatchForMinimap(patch);
    const additions = data.segments.filter((segment) => segment.kind === "addition");
    expect(additions[0]?.widthRatio).toBeGreaterThanOrEqual(0.15);
    expect(additions[0]?.widthRatio).toBeLessThanOrEqual(0.95);
    expect(additions[1]?.widthRatio).toBe(0.95);
    expect(additions[1]?.widthRatio).toBeGreaterThan(additions[0]?.widthRatio ?? 0);
  });

  it("assigns unique ids to every segment", () => {
    const patch = `@@ -1,3 +1,3 @@\n-a\n+a2\n-b\n+b2\n-c\n+c2`;
    const data = parsePatchForMinimap(patch);
    const ids = data.segments.map((segment) => segment.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("overlapsRanges", () => {
  it("returns true when segment intersects any range", () => {
    expect(
      overlapsRanges({ count: 3, id: "seg-1", kind: "addition", startLine: 5, widthRatio: 0.5 }, [
        [6, 10],
      ]),
    ).toBe(true);
  });

  it("returns false when ranges are disjoint", () => {
    expect(
      overlapsRanges({ count: 2, id: "seg-2", kind: "addition", startLine: 1, widthRatio: 0.5 }, [
        [10, 20],
      ]),
    ).toBe(false);
  });

  it("handles single-line ranges", () => {
    expect(
      overlapsRanges({ count: 1, id: "seg-3", kind: "deletion", startLine: 4, widthRatio: 0.5 }, [
        [4, 4],
      ]),
    ).toBe(true);
  });
});
