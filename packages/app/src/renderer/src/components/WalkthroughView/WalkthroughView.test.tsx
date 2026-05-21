import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils", () => ({
  cn: (...classes: (boolean | string | undefined)[]) => classes.filter(Boolean).join(" "),
}));

vi.mock("@pierre/diffs/react", () => ({
  PatchDiff: ({ patch }: { patch: string }) => <div data-diffs-container>{patch}</div>,
  WorkerPoolContextProvider: ({ children }: { children: ReactNode }) => children,
}));

import { WalkthroughView, hasMeaningfulDiffContent } from "./WalkthroughView";

const walkthrough = ["Intro", "```diff", "-old", "+new", "```", "Outro"].join("\n");

const stubMatchMedia = (matches: boolean): void => {
  vi.stubGlobal("window", {
    matchMedia: vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches,
      removeEventListener: vi.fn(),
    }),
  });
};

describe("WalkthroughView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("uses a single-column grid below the lg breakpoint", () => {
    stubMatchMedia(false);

    const html = renderToStaticMarkup(<WalkthroughView walkthrough={walkthrough} />);

    expect(html).toContain("grid-cols-[minmax(0,70ch)]");
    expect(html).not.toContain("grid-cols-[minmax(0,65ch)_minmax(0,1fr)]");
  });

  it("uses the anchored two-column grid at the lg breakpoint and above", () => {
    stubMatchMedia(true);

    const html = renderToStaticMarkup(<WalkthroughView walkthrough={walkthrough} />);

    expect(html).toContain("grid-cols-[minmax(0,65ch)_minmax(0,1fr)] gap-8");
  });

  it("detects meaningful diff content", () => {
    expect(hasMeaningfulDiffContent("")).toBe(false);
    expect(hasMeaningfulDiffContent("packages/app/src/main.ts")).toBe(false);
    expect(hasMeaningfulDiffContent("--- a/file.ts\n+++ b/file.ts")).toBe(false);
    expect(hasMeaningfulDiffContent("--- a/file.ts\n+++ b/file.ts\n-old\n+new")).toBe(true);
  });
});
