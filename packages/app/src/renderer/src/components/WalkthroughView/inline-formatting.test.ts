import { describe, expect, it } from "vitest";

import { parseInlineFormatting } from "./inline-formatting";

describe("parseInlineFormatting", () => {
  it("returns a single text token when there is no formatting", () => {
    const tokens = parseInlineFormatting("plain text only");
    expect(tokens.map(({ text, type }) => ({ text, type }))).toEqual([
      { text: "plain text only", type: "text" },
    ]);
  });

  it("extracts inline code with backticks", () => {
    const tokens = parseInlineFormatting("call `useState` to start");
    expect(tokens.map(({ text, type }) => ({ text, type }))).toEqual([
      { text: "call ", type: "text" },
      { text: "useState", type: "code" },
      { text: " to start", type: "text" },
    ]);
  });

  it("extracts bold with double asterisks", () => {
    const tokens = parseInlineFormatting("this is **important** here");
    expect(tokens.map(({ text, type }) => ({ text, type }))).toEqual([
      { text: "this is ", type: "text" },
      { text: "important", type: "bold" },
      { text: " here", type: "text" },
    ]);
  });

  it("extracts bold with double underscores", () => {
    const tokens = parseInlineFormatting("super __bold__ thing");
    expect(tokens.map(({ text, type }) => ({ text, type }))).toEqual([
      { text: "super ", type: "text" },
      { text: "bold", type: "bold" },
      { text: " thing", type: "text" },
    ]);
  });

  it("extracts italic with single asterisks", () => {
    const tokens = parseInlineFormatting("a *quick* note");
    expect(tokens.map(({ text, type }) => ({ text, type }))).toEqual([
      { text: "a ", type: "text" },
      { text: "quick", type: "italic" },
      { text: " note", type: "text" },
    ]);
  });

  it("extracts italic with single underscores", () => {
    const tokens = parseInlineFormatting("a _quick_ note");
    expect(tokens.map(({ text, type }) => ({ text, type }))).toEqual([
      { text: "a ", type: "text" },
      { text: "quick", type: "italic" },
      { text: " note", type: "text" },
    ]);
  });

  it("does not treat intra-word underscores as italics", () => {
    const tokens = parseInlineFormatting("name like snake_case_var stays whole");
    expect(tokens).toEqual([
      { id: "t1", text: "name like snake_case_var stays whole", type: "text" },
    ]);
  });

  it("does not treat surrounded-by-space single asterisks as italics", () => {
    const tokens = parseInlineFormatting("five * four = twenty");
    expect(tokens).toEqual([{ id: "t1", text: "five * four = twenty", type: "text" }]);
  });

  it("prefers bold (**) over a stray italic match", () => {
    const tokens = parseInlineFormatting("**very strong**");
    expect(tokens.map(({ text, type }) => ({ text, type }))).toEqual([
      { text: "very strong", type: "bold" },
    ]);
  });

  it("handles a mix of code, bold, and italic", () => {
    const tokens = parseInlineFormatting("Use **`pnpm`** with _no_ flags");
    const summary = tokens.map(({ text, type }) => ({ text, type }));
    expect(summary).toEqual([
      { text: "Use ", type: "text" },
      { text: "`pnpm`", type: "bold" },
      { text: " with ", type: "text" },
      { text: "no", type: "italic" },
      { text: " flags", type: "text" },
    ]);
  });

  it("assigns stable unique ids per token", () => {
    const tokens = parseInlineFormatting("a **b** c *d* e");
    const ids = new Set(tokens.map((token) => token.id));
    expect(ids.size).toBe(tokens.length);
  });
});
