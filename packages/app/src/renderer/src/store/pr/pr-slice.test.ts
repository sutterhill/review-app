import { describe, expect, it } from "vitest";

import { prActions, prReducer } from "./pr-slice";

describe("prReducer", () => {
  it("starts in the idle state", () => {
    expect(prReducer(undefined, { type: "unknown" }).status).toBe("idle");
  });

  it("tracks fetch requests without retaining stale data", () => {
    const state = prReducer(undefined, prActions.fetchPr("owner/repo#1"));

    expect(state.reference).toBe("owner/repo#1");
    expect(state.status).toBe("loading");
    expect(state.data).toBeNull();
    expect(state.error).toBeNull();
  });

  it("tracks open pull request loading separately", () => {
    const state = prReducer(undefined, prActions.fetchOpenPullRequests());

    expect(state.openPullRequestsStatus).toBe("loading");
    expect(state.openPullRequestsError).toBeNull();
  });
});
