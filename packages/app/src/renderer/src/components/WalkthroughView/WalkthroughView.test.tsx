import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils", () => ({
  cn: (...classes: (boolean | string | undefined)[]) => classes.filter(Boolean).join(" "),
}));

vi.mock("@pierre/diffs/react", () => ({
  PatchDiff: ({ patch }: { patch: string }) => <div data-diffs-container>{patch}</div>,
  WorkerPoolContextProvider: ({ children }: { children: ReactNode }) => children,
}));

import { WalkthroughView, hasMeaningfulDiffContent } from "./WalkthroughView";

const walkthrough = ["Intro", "```diff", "-old", "+new", "```", "Outro"].join("\n");

describe("WalkthroughView", () => {
  it("renders prose without diff blocks when diffs are hidden", () => {
    const html = renderToStaticMarkup(
      <WalkthroughView showDiffs={false} walkthrough={walkthrough} />,
    );

    expect(html).toContain("Intro");
    expect(html).toContain("Outro");
    expect(html).not.toContain("-old");
    expect(html).not.toContain("+new");
  });

  it("defers diff blocks from the initial render", () => {
    const html = renderToStaticMarkup(<WalkthroughView walkthrough={walkthrough} />);

    expect(html).toContain("Intro");
    expect(html).toContain("Outro");
    expect(html).not.toContain("-old");
    expect(html).not.toContain("+new");
  });

  it("detects meaningful diff content", () => {
    expect(hasMeaningfulDiffContent("")).toBe(false);
    expect(hasMeaningfulDiffContent("packages/app/src/main.ts")).toBe(false);
    expect(hasMeaningfulDiffContent("--- a/file.ts\n+++ b/file.ts")).toBe(false);
    expect(hasMeaningfulDiffContent("--- a/file.ts\n+++ b/file.ts\n-old\n+new")).toBe(true);
  });
});
