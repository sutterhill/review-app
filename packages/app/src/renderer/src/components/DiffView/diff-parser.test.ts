import { describe, expect, it } from "vitest";

import type { PullRequestFile } from "../../store/pr/pr-types";
import { parseUnifiedDiff } from "./diff-parser";

describe("parseUnifiedDiff", () => {
  it("matches raw diff chunks to GitHub file metadata", () => {
    const diff = [
      "diff --git a/src/a.ts b/src/a.ts",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "diff --git a/src/b.ts b/src/b.ts",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/src/b.ts",
      "@@ -0,0 +1 @@",
      "+created",
    ].join("\n");

    const files = [file("src/a.ts", "modified"), file("src/b.ts", "added")];

    expect(parseUnifiedDiff(diff, files)).toMatchObject([
      { path: "src/a.ts", status: "modified" },
      { path: "src/b.ts", status: "added" },
    ]);
  });

  it("builds a renderable file patch from GitHub file.patch when needed", () => {
    const [parsed] = parseUnifiedDiff("", [
      { ...file("src/new.ts", "added"), patch: "@@ -0,0 +1 @@\n+export const ok = true;" },
    ]);

    expect(parsed?.patch).toContain("diff --git a/src/new.ts b/src/new.ts");
    expect(parsed?.patch).toContain("--- /dev/null");
  });
});

const file = (filename: string, status: PullRequestFile["status"]): PullRequestFile => ({
  additions: status === "deleted" ? 0 : 1,
  changes: 1,
  deletions: status === "added" ? 0 : 1,
  filename,
  patch: "",
  status,
});
