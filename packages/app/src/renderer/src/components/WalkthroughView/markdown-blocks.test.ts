import { describe, expect, it } from "vitest";

import { parseBlocks } from "./markdown-blocks";

describe("parseBlocks", () => {
  it("joins consecutive non-blank lines into one paragraph", () => {
    expect(parseBlocks("first line\nsecond line\n\nnext para")).toEqual([
      { text: "first line second line", type: "paragraph" },
      { text: "next para", type: "paragraph" },
    ]);
  });

  it("parses unordered lists", () => {
    expect(parseBlocks("Intro\n\n- one\n- two\n- three")).toEqual([
      { text: "Intro", type: "paragraph" },
      { items: ["one", "two", "three"], ordered: false, type: "list" },
    ]);
  });

  it("parses ordered lists", () => {
    expect(parseBlocks("1. first\n2. second\n3. third")).toEqual([
      { items: ["first", "second", "third"], ordered: true, type: "list" },
    ]);
  });

  it("supports indented continuation lines in list items", () => {
    const parsed = parseBlocks("- first item\n  continued\n- second");
    expect(parsed).toEqual([
      { items: ["first item continued", "second"], ordered: false, type: "list" },
    ]);
  });

  it("parses fenced code blocks with language", () => {
    const parsed = parseBlocks("Before\n\n```ts\nconst a = 1;\nconst b = 2;\n```\n\nAfter");
    expect(parsed).toEqual([
      { text: "Before", type: "paragraph" },
      { content: "const a = 1;\nconst b = 2;", lang: "ts", type: "code" },
      { text: "After", type: "paragraph" },
    ]);
  });

  it("parses fenced code without language", () => {
    const parsed = parseBlocks("```\nplain\n```");
    expect(parsed).toEqual([{ content: "plain", lang: null, type: "code" }]);
  });

  it("parses a GitHub-flavored table with alignment", () => {
    const md = [
      "| Name | Type | Notes |",
      "|:-----|:----:|------:|",
      "| a | b | c |",
      "| d | e | f |",
    ].join("\n");
    expect(parseBlocks(md)).toEqual([
      {
        align: ["left", "center", "right"],
        header: ["Name", "Type", "Notes"],
        rows: [
          ["a", "b", "c"],
          ["d", "e", "f"],
        ],
        type: "table",
      },
    ]);
  });

  it("does not treat a non-table pipe row as a table", () => {
    expect(parseBlocks("a | b | c\nnext line")).toEqual([
      { text: "a | b | c next line", type: "paragraph" },
    ]);
  });

  it("pads or truncates row cells to match the header width", () => {
    const md = ["| h1 | h2 | h3 |", "|----|----|----|", "| a | b |", "| x | y | z | extra |"].join(
      "\n",
    );
    const parsed = parseBlocks(md);
    expect(parsed[0]).toMatchObject({
      header: ["h1", "h2", "h3"],
      rows: [
        ["a", "b", ""],
        ["x", "y", "z"],
      ],
    });
  });

  it("returns an empty array for empty input", () => {
    expect(parseBlocks("")).toEqual([]);
    expect(parseBlocks("   \n\n   ")).toEqual([]);
  });
});
