import { describe, expect, it } from "vitest";

import type { ParsedDiffFile } from "../DiffView";
import {
  buildNarrativeSections,
  isFormattingOnlyPatch,
  shouldCollapseDiffSection,
} from "./narrative-parser";

describe("buildNarrativeSections", () => {
  it("places diffs in the order files are referenced by the narrative", () => {
    const sections = buildNarrativeSections(
      "First review `src/b.ts`.\n\nThen inspect src/a.ts for the call site.",
      [file("src/a.ts"), file("src/b.ts")],
    );

    expect(sections.map((section) => section.filePaths).flat()).toEqual(["src/b.ts", "src/a.ts"]);
  });

  it("matches unique basenames and appends unreferenced files at the end", () => {
    const sections = buildNarrativeSections("The App.tsx change wires the UI.", [
      file("src/App.tsx"),
      file("src/store/pr.ts"),
    ]);

    expect(sections[0]?.filePaths).toEqual(["src/App.tsx"]);
    expect(sections.at(-1)).toMatchObject({
      filePaths: ["src/store/pr.ts"],
      isFallback: true,
    });
  });
});

describe("formatting noise detection", () => {
  it("detects whitespace-only changes", () => {
    expect(
      isFormattingOnlyPatch(
        [
          "diff --git a/src/a.ts b/src/a.ts",
          "@@ -1 +1 @@",
          "-const value=1;",
          "+const value = 1;",
        ].join("\n"),
      ),
    ).toBe(false);

    expect(
      isFormattingOnlyPatch(
        [
          "diff --git a/src/a.ts b/src/a.ts",
          "@@ -1 +1 @@",
          "-const value = 1;",
          "+  const   value = 1;",
        ].join("\n"),
      ),
    ).toBe(true);
  });

  it("detects import sorting and collapses those diffs by default", () => {
    const sortingPatch = [
      "diff --git a/src/a.ts b/src/a.ts",
      "@@ -1,2 +1,2 @@",
      "-import z from 'z';",
      "-import a from 'a';",
      "+import a from 'a';",
      "+import z from 'z';",
    ].join("\n");

    expect(isFormattingOnlyPatch(sortingPatch)).toBe(true);
    expect(shouldCollapseDiffSection(file("src/a.ts", sortingPatch))).toBe(true);
  });
});

const file = (path: string, patch = ""): ParsedDiffFile => ({
  additions: 1,
  changes: 1,
  deletions: 0,
  patch,
  path,
  status: "modified",
});
