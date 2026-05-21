import { describe, expect, it } from "vitest";

import { buildSnippetPatch } from "./build-snippet-patch";
import type { SnippetLine } from "./extract-snippet";

describe("buildSnippetPatch", () => {
  it("returns empty string when no lines provided", () => {
    expect(buildSnippetPatch("foo.ts", [])).toBe("");
  });

  it("emits a single hunk for contiguous lines", () => {
    const lines: SnippetLine[] = [
      { content: "const a = 1;", kind: "context", lineNumber: 10 },
      { content: "const b = 2;", kind: "addition", lineNumber: 11 },
      { content: "const c = 3;", kind: "context", lineNumber: 12 },
    ];
    const patch = buildSnippetPatch("foo.ts", lines);
    expect(patch).toContain("diff --git a/foo.ts b/foo.ts");
    expect(patch).toContain("--- a/foo.ts");
    expect(patch).toContain("+++ b/foo.ts");
    expect(patch).toMatch(/@@ -10,2 \+10,3 @@/u);
    expect(patch).toContain(" const a = 1;");
    expect(patch).toContain("+const b = 2;");
    expect(patch).toContain(" const c = 3;");
  });

  it("splits non-contiguous lines into multiple hunks", () => {
    const lines: SnippetLine[] = [
      { content: "first", kind: "context", lineNumber: 5 },
      { content: "second", kind: "context", lineNumber: 6 },
      { content: "later", kind: "addition", lineNumber: 50 },
    ];
    const patch = buildSnippetPatch("a.ts", lines);
    const hunkMarkers = patch.match(/@@/gu) ?? [];
    expect(hunkMarkers.length).toBe(2 * 2);
    expect(patch).toMatch(/@@ -5,2 \+5,2 @@/u);
    expect(patch).toMatch(/@@ -49,0 \+50,1 @@/u);
  });

  it("uses zero oldLen and decremented oldStart for pure-addition hunks", () => {
    const lines: SnippetLine[] = [{ content: "new line", kind: "addition", lineNumber: 7 }];
    const patch = buildSnippetPatch("x.ts", lines);
    expect(patch).toMatch(/@@ -6,0 \+7,1 @@/u);
  });
});
