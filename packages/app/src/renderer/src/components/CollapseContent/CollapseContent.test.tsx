import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils", () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(" "),
}));

import { CollapseContent } from "./CollapseContent";

describe("CollapseContent", () => {
  it("renders children at full height (grid-rows-[1fr]) when expanded", () => {
    const html = renderToStaticMarkup(
      <CollapseContent collapsed={false}>
        <p>diff body</p>
      </CollapseContent>,
    );

    expect(html).toContain("grid-rows-[1fr]");
    expect(html).not.toContain("grid-rows-[0fr]");
    expect(html).toContain("diff body");
    expect(html).not.toContain("aria-hidden");
    expect(html).not.toContain("data-collapsed");
  });

  it("collapses to zero rows and marks the wrapper as hidden", () => {
    const html = renderToStaticMarkup(
      <CollapseContent collapsed>
        <p>diff body</p>
      </CollapseContent>,
    );

    expect(html).toContain("grid-rows-[0fr]");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-collapsed=""');
  });

  it("animates the height with the requested duration via transition styles", () => {
    const html = renderToStaticMarkup(
      <CollapseContent collapsed durationMs={300}>
        <span />
      </CollapseContent>,
    );

    expect(html).toContain("transition-[grid-template-rows]");
    expect(html).toContain("motion-reduce:transition-none");
    expect(html).toContain("transition-duration:300ms");
  });
});
