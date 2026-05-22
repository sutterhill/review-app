import { describe, expect, it } from "vitest";

import { extractStreamingLine } from "./streaming-line";

describe("extractStreamingLine", () => {
  it("returns empty string for empty input", () => {
    expect(extractStreamingLine("")).toBe("");
    expect(extractStreamingLine("   \n  ")).toBe("");
  });

  it("returns the content of a trailing partial quoted string", () => {
    const raw = '{"description":"This PR adds a new feature for handling';
    expect(extractStreamingLine(raw)).toBe("This PR adds a new feature for handling");
  });

  it("returns the content of a trailing complete quoted string", () => {
    const raw = '{"description":"Adds dark mode"';
    expect(extractStreamingLine(raw)).toBe("Adds dark mode");
  });

  it("unescapes JSON escape sequences in the quoted value", () => {
    const raw = '{"description":"line one\\nline two';
    expect(extractStreamingLine(raw)).toBe("line two");
  });

  it("returns the most recent quoted value when streaming has paused on a key", () => {
    const raw = '{\n  "description": "Adds X",\n  "steps": [\n    { "heading":';
    expect(extractStreamingLine(raw)).toBe("heading");
  });

  it("ignores trailing punctuation-only lines after a complete value", () => {
    const raw = '{ "description": "Adds X" }\n  ,\n  ';
    expect(extractStreamingLine(raw)).toBe("Adds X");
  });

  it("returns empty string when there are no quoted strings yet", () => {
    expect(extractStreamingLine("{\n  ")).toBe("");
  });
});
