import { describe, expect, it } from "vitest";

import { walkthroughActions, walkthroughReducer } from "./walkthrough-slice";
import type { WalkthroughResponse } from "./walkthrough-types";

const sampleResponse: WalkthroughResponse = {
  description: "TL;DR",
  groups: [{ filePaths: ["src/a.ts"], title: "Core" }],
  steps: [{ body: "Body", heading: "Step 1", relevantFiles: [{ path: "src/a.ts" }] }],
  suggestedQuestions: ["Why?"],
};

describe("walkthroughReducer", () => {
  it("starts in the idle state", () => {
    expect(walkthroughReducer(undefined, { type: "unknown" })).toEqual({
      error: null,
      messages: [],
      status: "idle",
    });
  });

  it("creates a placeholder message when streaming starts", () => {
    const state = walkthroughReducer(
      undefined,
      walkthroughActions.generateWalkthroughStarted({ id: "m1" }),
    );
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({
      id: "m1",
      kind: "initial",
      parsed: null,
      raw: "",
      status: "loading",
    });
  });

  it("appends chunks and stores partial parsed", () => {
    let state = walkthroughReducer(
      undefined,
      walkthroughActions.generateWalkthroughStarted({ id: "m1" }),
    );
    state = walkthroughReducer(
      state,
      walkthroughActions.appendMessageChunk({ chunk: '{"d', id: "m1", parsed: null }),
    );
    state = walkthroughReducer(
      state,
      walkthroughActions.appendMessageChunk({
        chunk: 'escription":"hi"}',
        id: "m1",
        parsed: { description: "hi", groups: [], steps: [], suggestedQuestions: [] },
      }),
    );
    expect(state.messages[0]?.raw).toBe('{"description":"hi"}');
    expect(state.messages[0]?.parsed?.description).toBe("hi");
    expect(state.status).toBe("streaming");
  });

  it("marks message as succeeded and saves final parsed", () => {
    let state = walkthroughReducer(
      undefined,
      walkthroughActions.generateWalkthroughStarted({ id: "m1" }),
    );
    state = walkthroughReducer(
      state,
      walkthroughActions.messageSucceeded({ id: "m1", parsed: sampleResponse }),
    );
    expect(state.status).toBe("succeeded");
    expect(state.messages[0]?.status).toBe("succeeded");
    expect(state.messages[0]?.parsed).toEqual(sampleResponse);
  });

  it("appends a follow-up message", () => {
    let state = walkthroughReducer(
      undefined,
      walkthroughActions.generateWalkthroughStarted({ id: "m1" }),
    );
    state = walkthroughReducer(
      state,
      walkthroughActions.messageSucceeded({ id: "m1", parsed: sampleResponse }),
    );
    state = walkthroughReducer(
      state,
      walkthroughActions.askFollowUp({ id: "m2", question: "more?" }),
    );
    expect(state.messages).toHaveLength(2);
    expect(state.messages[1]).toMatchObject({
      id: "m2",
      kind: "follow-up",
      question: "more?",
      status: "loading",
    });
    expect(state.status).toBe("loading");
  });

  it("marks failure with error and per-message status", () => {
    let state = walkthroughReducer(
      undefined,
      walkthroughActions.generateWalkthroughStarted({ id: "m1" }),
    );
    state = walkthroughReducer(
      state,
      walkthroughActions.messageFailed({ error: "boom", id: "m1" }),
    );
    expect(state.error).toBe("boom");
    expect(state.status).toBe("failed");
    expect(state.messages[0]?.status).toBe("failed");
  });

  it("clears state when generation restarts", () => {
    let state = walkthroughReducer(
      undefined,
      walkthroughActions.generateWalkthroughStarted({ id: "m1" }),
    );
    state = walkthroughReducer(
      state,
      walkthroughActions.messageSucceeded({ id: "m1", parsed: sampleResponse }),
    );
    state = walkthroughReducer(state, walkthroughActions.generateWalkthrough());
    expect(state.messages).toEqual([]);
    expect(state.status).toBe("loading");
  });

  it("loads cached messages", () => {
    const state = walkthroughReducer(
      undefined,
      walkthroughActions.loadCachedWalkthroughSucceeded({
        messages: [
          { id: "m1", kind: "initial", parsed: sampleResponse, raw: "{}", status: "succeeded" },
        ],
      }),
    );
    expect(state.status).toBe("succeeded");
    expect(state.messages).toHaveLength(1);
  });
});
