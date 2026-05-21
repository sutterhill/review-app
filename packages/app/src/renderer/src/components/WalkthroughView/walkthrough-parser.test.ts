import { describe, expect, it } from "vitest";

import {
  buildWalkthroughLayout,
  buildWalkthroughSections,
  extractWalkthroughHeadings,
  splitIntoChunks,
} from "./walkthrough-parser";

describe("buildWalkthroughSections", () => {
  it("splits walkthrough markdown into narrative sections", () => {
    const sections = buildWalkthroughSections(
      "First review `src/b.ts`.\n\nThen inspect src/a.ts for the call site.",
    );

    expect(sections).toEqual([
      { id: "walkthrough-0", markdown: "First review `src/b.ts`." },
      { id: "walkthrough-1", markdown: "Then inspect src/a.ts for the call site." },
    ]);
  });

  it("keeps fenced code blocks in one section", () => {
    const sections = buildWalkthroughSections("Intro\n\n```ts\nconst value = 1;\n\n```\n\nOutro");

    expect(sections).toHaveLength(3);
    expect(sections[1]?.markdown).toBe("```ts\nconst value = 1;\n\n```");
  });
});

describe("extractWalkthroughHeadings", () => {
  it("returns ordered heading metadata with stable ids", () => {
    expect(
      extractWalkthroughHeadings("# Overview\nText\n### Risk\n##### Ignored\n## Next"),
    ).toEqual([
      { id: "wt-0", level: 1, text: "Overview" },
      { id: "wt-1", level: 3, text: "Risk" },
      { id: "wt-2", level: 2, text: "Next" },
    ]);
  });
});

describe("buildWalkthroughLayout", () => {
  it("extracts diff fences into anchored diffs while preserving continuous prose", () => {
    expect(buildWalkthroughLayout("Intro\n```diff\n-old\n+new\n```\nOutro")).toEqual({
      diffs: [{ anchorId: "diff-anchor-0", code: "-old\n+new", label: undefined }],
      prose: "Intro\n<<DIFF_ANCHOR:diff-anchor-0>>\nOutro",
    });
  });

  it("moves italic file labels onto anchored diffs", () => {
    expect(buildWalkthroughLayout("Before\n*src/app.ts*\n```diff\n+value\n```\nAfter")).toEqual({
      diffs: [{ anchorId: "diff-anchor-0", code: "+value", label: "src/app.ts" }],
      prose: "Before\n<<DIFF_ANCHOR:diff-anchor-0>>\nAfter",
    });
  });

  it("numbers multiple diff anchors in source order", () => {
    expect(buildWalkthroughLayout("A\n```diff\n+a\n```\nB\n```diff\n+b\n```")).toEqual({
      diffs: [
        { anchorId: "diff-anchor-0", code: "+a", label: undefined },
        { anchorId: "diff-anchor-1", code: "+b", label: undefined },
      ],
      prose: "A\n<<DIFF_ANCHOR:diff-anchor-0>>\nB\n<<DIFF_ANCHOR:diff-anchor-1>>",
    });
  });

  it("leaves non-diff code fences in prose", () => {
    expect(buildWalkthroughLayout("Before\n```ts\nconst value = 1;\n```\nAfter")).toEqual({
      diffs: [],
      prose: "Before\n```ts\nconst value = 1;\n```\nAfter",
    });
  });

  it("returns unclosed diff fences to prose", () => {
    expect(buildWalkthroughLayout("Before\n_src/app.ts_\n```diff\n+value")).toEqual({
      diffs: [],
      prose: "Before\n*src/app.ts*\n```diff\n+value",
    });
  });
});

describe("splitIntoChunks", () => {
  it("extracts diff fences as interleaved chunks", () => {
    expect(splitIntoChunks("Intro\n```diff\n-old\n+new\n```\nOutro")).toEqual([
      { markdown: "Intro", type: "prose" },
      { code: "-old\n+new", label: undefined, type: "diff" },
      { markdown: "Outro", type: "prose" },
    ]);
  });

  it("moves italic file labels onto the extracted diff", () => {
    expect(splitIntoChunks("Before\n*src/app.ts*\n```diff\n+value\n```\nAfter")).toEqual([
      { markdown: "Before", type: "prose" },
      { code: "+value", label: "src/app.ts", type: "diff" },
      { markdown: "After", type: "prose" },
    ]);
  });

  it("returns unclosed diff fences to prose", () => {
    expect(splitIntoChunks("Before\n_src/app.ts_\n```diff\n+value")).toEqual([
      { markdown: "Before\n*src/app.ts*\n```diff\n+value", type: "prose" },
    ]);
  });

  it("collapses whitespace around extracted diffs", () => {
    expect(splitIntoChunks("Intro\n\n\n```diff\n+value\n```\n\n\nOutro")).toEqual([
      { markdown: "Intro", type: "prose" },
      { code: "+value", label: undefined, type: "diff" },
      { markdown: "Outro", type: "prose" },
    ]);
  });
});
