import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders common GitHub markdown formatting", () => {
    const html = renderToStaticMarkup(
      <Markdown
        content={[
          "# Title",
          "",
          "> Quoted **note**",
          "",
          "Visit [GitHub](https://github.com) and `code`.",
          "",
          "- _first_",
          "- second",
        ].join("\n")}
      />,
    );

    expect(html).toContain("<h2");
    expect(html).toContain("<blockquote");
    expect(html).toContain("<strong>note</strong>");
    expect(html).toContain('href="https://github.com"');
    expect(html).toContain("<code");
    expect(html).toContain("<ul");
    expect(html).toContain("<em>first</em>");
  });
});
