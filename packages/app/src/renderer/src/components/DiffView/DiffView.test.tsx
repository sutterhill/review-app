import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PullRequestData, PullRequestFile } from "../../store/pr/pr-types";

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}));

vi.mock("@pierre/diffs/react", () => ({
  PatchDiff: ({ patch }: { patch: string }) => <pre data-diffs-container>{patch}</pre>,
  WorkerPoolContextProvider: ({ children }: { children: ReactNode }) => children,
}));

import { DiffView } from "./DiffView";

describe("DiffView", () => {
  it("renders the first three file patches eagerly and defers later patches", () => {
    const html = renderToStaticMarkup(
      <DiffView onFileElement={() => {}} pullRequest={pullRequestWithFiles(4)} />,
    );

    expect(html).toContain("src/file-1.ts");
    expect(html).toContain("new 1");
    expect(html).toContain("new 2");
    expect(html).toContain("new 3");
    expect(html).toContain("src/file-4.ts");
    expect(html).toContain("Loading diff");
    expect(html).not.toContain("new 4");
  });

  it("keeps the no textual diff message for files without a patch", () => {
    const pullRequest = pullRequestWithFiles(1, [file("dist/bundle.js", "")]);
    const html = renderToStaticMarkup(
      <DiffView onFileElement={() => {}} pullRequest={pullRequest} />,
    );

    expect(html).toContain("dist/bundle.js");
    expect(html).toContain("No textual diff is available for this file.");
  });
});

const pullRequestWithFiles = (
  count: number,
  additionalFiles: PullRequestFile[] = [],
): PullRequestData => ({
  diff: "",
  files: Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return file(`src/file-${number}.ts`, `@@ -1 +1 @@\n-old ${number}\n+new ${number}`);
  }).concat(additionalFiles),
  metadata: {
    author: { avatarUrl: null, login: "author", url: "https://example.com/author" },
    body: "",
    createdAt: "2026-05-21T00:00:00.000Z",
    htmlUrl: "https://example.com/pr/1",
    labels: [],
    number: 1,
    owner: "owner",
    reference: "owner/repo#1",
    repo: "repo",
    reviewers: [],
    state: "open",
    title: "Test PR",
    updatedAt: "2026-05-21T00:00:00.000Z",
  },
});

const file = (filename: string, patch: string): PullRequestFile => ({
  additions: patch ? 1 : 0,
  changes: patch ? 2 : 0,
  deletions: patch ? 1 : 0,
  filename,
  patch,
  status: "modified",
});
