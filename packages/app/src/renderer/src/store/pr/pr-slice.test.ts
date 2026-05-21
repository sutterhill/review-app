import { describe, expect, it } from "vitest";

import { prActions, prReducer } from "./pr-slice";

describe("prReducer", () => {
  it("starts in the idle state", () => {
    const state = prReducer(undefined, { type: "unknown" });

    expect(state.status).toBe("idle");
    expect(state.comments).toEqual([]);
    expect(state.commentsStatus).toBe("idle");
  });

  it("tracks fetch requests without retaining stale data", () => {
    const loadedState = prReducer(
      undefined,
      prActions.fetchCommentsSucceeded([
        {
          author: { avatarUrl: null, login: "octocat", url: "" },
          body: "Looks good.",
          createdAt: "2026-05-21T00:00:00.000Z",
          id: 1,
          updatedAt: "2026-05-21T00:00:00.000Z",
        },
      ]),
    );
    const state = prReducer(loadedState, prActions.fetchPr("owner/repo#1"));

    expect(state.reference).toBe("owner/repo#1");
    expect(state.status).toBe("loading");
    expect(state.data).toBeNull();
    expect(state.error).toBeNull();
    expect(state.comments).toEqual([]);
    expect(state.commentsStatus).toBe("idle");
  });

  it("tracks comment loading separately", () => {
    const state = prReducer(undefined, prActions.fetchComments());

    expect(state.commentsStatus).toBe("loading");
    expect(state.commentsError).toBeNull();
  });

  it("tracks open pull request loading separately", () => {
    const state = prReducer(undefined, prActions.fetchOpenPullRequests());

    expect(state.openPullRequestsStatus).toBe("loading");
    expect(state.openPullRequestsError).toBeNull();
  });
});
