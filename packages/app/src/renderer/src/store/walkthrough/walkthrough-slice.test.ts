import { describe, expect, it } from "vitest";

import { walkthroughActions, walkthroughReducer } from "./walkthrough-slice";

describe("walkthroughReducer", () => {
  it("starts in the idle state", () => {
    expect(walkthroughReducer(undefined, { type: "unknown" })).toEqual({
      content: "",
      error: null,
      status: "idle",
    });
  });

  it("resets prior output when generation starts", () => {
    const previous = walkthroughReducer(
      undefined,
      walkthroughActions.appendWalkthroughChunk("old"),
    );
    const state = walkthroughReducer(previous, walkthroughActions.generateWalkthrough());

    expect(state).toEqual({ content: "", error: null, status: "loading" });
  });

  it("streams chunks into content", () => {
    const first = walkthroughReducer(undefined, walkthroughActions.appendWalkthroughChunk("hello"));
    const second = walkthroughReducer(first, walkthroughActions.appendWalkthroughChunk(" world"));

    expect(second.content).toBe("hello world");
    expect(second.status).toBe("streaming");
  });

  it("surfaces generation errors", () => {
    const state = walkthroughReducer(
      undefined,
      walkthroughActions.generateWalkthroughFailed("No PR"),
    );

    expect(state.error).toBe("No PR");
    expect(state.status).toBe("failed");
  });

  it("marks cached walkthrough loading", () => {
    const state = walkthroughReducer(undefined, walkthroughActions.loadCachedWalkthrough());

    expect(state).toEqual({ content: "", error: null, status: "loading" });
  });

  it("loads cached walkthrough content", () => {
    const state = walkthroughReducer(
      undefined,
      walkthroughActions.loadCachedWalkthroughSucceeded("Cached walkthrough"),
    );

    expect(state).toEqual({ content: "Cached walkthrough", error: null, status: "succeeded" });
  });

  it("returns to idle when cached walkthrough is missing", () => {
    const loading = walkthroughReducer(undefined, walkthroughActions.loadCachedWalkthrough());
    const state = walkthroughReducer(loading, walkthroughActions.loadCachedWalkthroughNotFound());

    expect(state).toEqual({ content: "", error: null, status: "idle" });
  });
});
