import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils", () => ({
  cn: (...classes: (boolean | string | undefined)[]) => classes.filter(Boolean).join(" "),
}));

import { WalkthroughView } from "./WalkthroughView";

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

  it("renders diff blocks by default", () => {
    const html = renderToStaticMarkup(<WalkthroughView walkthrough={walkthrough} />);

    expect(html).toContain("-old");
    expect(html).toContain("+new");
  });
});
