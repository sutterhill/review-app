import { describe, expect, it } from "vitest";

import { narrativeActions, narrativeReducer } from "./narrative-slice";

describe("narrativeReducer", () => {
  it("starts in the idle state", () => {
    expect(narrativeReducer(undefined, { type: "unknown" })).toEqual({
      content: "",
      error: null,
      status: "idle",
    });
  });

  it("resets prior output when generation starts", () => {
    const previous = narrativeReducer(undefined, narrativeActions.appendNarrativeChunk("old"));
    const state = narrativeReducer(previous, narrativeActions.generateNarrative());

    expect(state).toEqual({ content: "", error: null, status: "loading" });
  });

  it("streams chunks into content", () => {
    const first = narrativeReducer(undefined, narrativeActions.appendNarrativeChunk("hello"));
    const second = narrativeReducer(first, narrativeActions.appendNarrativeChunk(" world"));

    expect(second.content).toBe("hello world");
    expect(second.status).toBe("streaming");
  });

  it("surfaces generation errors", () => {
    const state = narrativeReducer(undefined, narrativeActions.generateNarrativeFailed("No PR"));

    expect(state.error).toBe("No PR");
    expect(state.status).toBe("failed");
  });
});
