import { describe, expect, it } from "vitest";

import { normalizeLineRanges } from "./normalize-line-ranges";

describe("normalizeLineRanges", () => {
  it("returns empty array for nullish input", () => {
    expect(normalizeLineRanges(null)).toEqual([]);
    expect(normalizeLineRanges(undefined)).toEqual([]);
  });

  it("treats a single positive number as a one-line range", () => {
    expect(normalizeLineRanges(26)).toEqual([[26, 26]]);
  });

  it("treats a single-element array as a one-line range", () => {
    expect(normalizeLineRanges([26])).toEqual([[26, 26]]);
  });

  it("treats a two-number array as a single [start, end] tuple", () => {
    expect(normalizeLineRanges([10, 20])).toEqual([[10, 20]]);
    expect(normalizeLineRanges([26, 40])).toEqual([[26, 40]]);
  });

  it("preserves nested tuples", () => {
    expect(
      normalizeLineRanges([
        [10, 20],
        [30, 40],
      ]),
    ).toEqual([
      [10, 20],
      [30, 40],
    ]);
  });

  it("parses string ranges like 'L10-20' and 'L5'", () => {
    expect(normalizeLineRanges(["L10-20", "L5"])).toEqual([
      [10, 20],
      [5, 5],
    ]);
  });

  it("parses object ranges with start/end", () => {
    expect(normalizeLineRanges([{ end: 20, start: 10 }])).toEqual([[10, 20]]);
  });

  it("clamps inverted tuples to a single line", () => {
    expect(normalizeLineRanges([[20, 5]])).toEqual([[20, 20]]);
  });

  it("drops invalid entries silently", () => {
    expect(normalizeLineRanges([0, -3, "abc", null, [10, 12]])).toEqual([[10, 12]]);
  });
});
