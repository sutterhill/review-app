import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils", () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(" "),
}));

import { CollapseChevron } from "./CollapseChevron";

describe("CollapseChevron", () => {
  it("faces down (no rotation) when expanded", () => {
    const html = renderToStaticMarkup(<CollapseChevron collapsed={false} />);

    expect(html).not.toContain("rotate-90");
    expect(html).not.toContain("data-collapsed");
  });

  it("rotates to face left when collapsed", () => {
    const html = renderToStaticMarkup(<CollapseChevron collapsed />);

    expect(html).toContain("rotate-90");
    expect(html).toContain('data-collapsed=""');
  });

  it("animates the rotation via a transform transition", () => {
    const html = renderToStaticMarkup(<CollapseChevron collapsed />);

    expect(html).toContain("transition-transform");
    expect(html).toContain("motion-reduce:transition-none");
  });

  it("forwards a caller-supplied className", () => {
    const html = renderToStaticMarkup(<CollapseChevron className="size-3.5" collapsed={false} />);

    expect(html).toContain("size-3.5");
  });
});
