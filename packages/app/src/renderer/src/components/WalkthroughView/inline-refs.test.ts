import { describe, expect, it } from "vitest";

import { extractRelevantFiles, parseInlineNodes, parseInlineRef } from "./inline-refs";

describe("parseInlineRef", () => {
  it("parses a path-only ref", () => {
    expect(parseInlineRef("src/a.ts")).toEqual({ lineRanges: [], path: "src/a.ts", symbol: null });
  });

  it("parses a line range", () => {
    expect(parseInlineRef("src/a.ts#L10-20")).toEqual({
      lineRanges: [[10, 20]],
      path: "src/a.ts",
      symbol: null,
    });
  });

  it("parses a single line", () => {
    expect(parseInlineRef("src/a.ts#L4")).toEqual({
      lineRanges: [[4, 4]],
      path: "src/a.ts",
      symbol: null,
    });
  });

  it("parses multiple comma-separated ranges", () => {
    expect(parseInlineRef("src/a.ts#L1-2,L4-6")).toEqual({
      lineRanges: [
        [1, 2],
        [4, 6],
      ],
      path: "src/a.ts",
      symbol: null,
    });
  });

  it("parses a symbol", () => {
    expect(parseInlineRef("src/a.ts#symbol:foo")).toEqual({
      lineRanges: [],
      path: "src/a.ts",
      symbol: "foo",
    });
  });
});

describe("parseInlineNodes", () => {
  it("returns a single text node when no refs are present", () => {
    expect(parseInlineNodes("hello world")).toEqual([{ text: "hello world", type: "text" }]);
  });

  it("splits prose around a ref", () => {
    const nodes = parseInlineNodes("see {{ref:src/a.ts#L1-2}} now");
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toMatchObject({ type: "text", text: "see " });
    expect(nodes[1]).toMatchObject({ type: "ref", path: "src/a.ts" });
    expect(nodes[2]).toMatchObject({ type: "text", text: " now" });
  });
});

describe("extractRelevantFiles", () => {
  it("deduplicates files and merges ranges", () => {
    const files = extractRelevantFiles(
      "a {{ref:foo.ts#L1-2}} b {{ref:foo.ts#L5-6}} c {{ref:bar.ts}}",
    );
    expect(files).toHaveLength(2);
    const foo = files.find((file) => file.path === "foo.ts");
    expect(foo?.lineRanges).toEqual([
      [1, 2],
      [5, 6],
    ]);
    const bar = files.find((file) => file.path === "bar.ts");
    expect(bar?.lineRanges).toEqual([]);
  });
});
