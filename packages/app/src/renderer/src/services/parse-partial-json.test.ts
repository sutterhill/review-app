import { describe, expect, it } from "vitest";

import { parsePartialJson } from "./parse-partial-json";

describe("parsePartialJson", () => {
  it("returns null for empty input", () => {
    expect(parsePartialJson("")).toBeNull();
    expect(parsePartialJson("   ")).toBeNull();
  });

  it("parses complete JSON", () => {
    expect(parsePartialJson('{"a":1,"b":[1,2]}')).toEqual({ a: 1, b: [1, 2] });
  });

  it("ignores prose before JSON starts", () => {
    expect(parsePartialJson('hello {"a":1}')).toEqual({ a: 1 });
  });

  it("closes an unterminated object", () => {
    expect(parsePartialJson('{"a":1')).toEqual({ a: 1 });
  });

  it("closes nested unterminated structures", () => {
    expect(parsePartialJson('{"a":{"b":[1,2')).toEqual({ a: { b: [1, 2] } });
  });

  it("drops an unterminated string value", () => {
    expect(parsePartialJson('{"a":"hello')).toEqual({ a: "hello" } as never);
  });

  it("drops a trailing key-only field", () => {
    expect(parsePartialJson('{"a":1,"b"')).toEqual({ a: 1 });
  });

  it("drops a dangling comma", () => {
    expect(parsePartialJson('{"a":1,')).toEqual({ a: 1 });
  });

  it("parses partial arrays of objects", () => {
    expect(parsePartialJson('{"steps":[{"heading":"a","body":"hi"},{"heading":"b"')).toEqual({
      steps: [{ heading: "a", body: "hi" }, { heading: "b" }],
    });
  });

  it("preserves escaped quotes inside strings", () => {
    expect(parsePartialJson('{"a":"he said \\"hi\\""}')).toEqual({ a: 'he said "hi"' });
  });
});
