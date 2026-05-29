import { describe, expect, it } from "vitest";

import { prActions, prReducer } from "./pr-slice";

describe("prReducer", () => {
  it("starts in the idle state", () => {
    const state = prReducer(undefined, { type: "unknown" });

    expect(state.status).toBe("idle");
    expect(state.comments).toEqual([]);
    expect(state.commentsStatus).toBe("idle");
    expect(state.myPullRequests).toEqual([]);
    expect(state.myPullRequestsStatus).toBe("idle");
    expect(state.prListMode).toBe("needs-review");
    expect(state.readyToMergePullRequests).toEqual([]);
    expect(state.waitingOnAuthorPullRequests).toEqual([]);
    expect(state.waitingStatus).toBe("idle");
    expect(state.waitingError).toBeNull();
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

  it("tracks my pull request loading separately", () => {
    const state = prReducer(undefined, prActions.fetchMyPullRequests());

    expect(state.myPullRequestsStatus).toBe("loading");
    expect(state.myPullRequestsError).toBeNull();
  });

  it("stores my pull request results", () => {
    const state = prReducer(
      undefined,
      prActions.fetchMyPullRequestsSucceeded([
        {
          author: { avatarUrl: null, login: "octocat", url: "" },
          headRefName: "feature-branch",
          htmlUrl: "https://github.com/acme/repo/pull/1",
          isDraft: false,
          number: 1,
          owner: "acme",
          reference: "acme/repo#1",
          repo: "repo",
          repositoryName: "acme/repo",
          reviewDecision: null,
          title: "Add app value",
          updatedAt: "2026-05-20T00:00:00.000Z",
        },
      ]),
    );

    expect(state.myPullRequests).toHaveLength(1);
    expect(state.myPullRequestsError).toBeNull();
    expect(state.myPullRequestsStatus).toBe("succeeded");
  });

  it("tracks waiting pull request loading separately", () => {
    const state = prReducer(undefined, prActions.fetchWaitingPullRequests());

    expect(state.waitingStatus).toBe("loading");
    expect(state.waitingError).toBeNull();
  });

  it("stores waiting pull request results in both sections", () => {
    const readyToMerge = {
      author: { avatarUrl: null, login: "octocat", url: "" },
      headRefName: "feature-branch",
      htmlUrl: "https://github.com/acme/repo/pull/1",
      isDraft: false,
      number: 1,
      owner: "acme",
      reference: "acme/repo#1",
      repo: "repo",
      repositoryName: "acme/repo",
      reviewDecision: null,
      title: "Add app value",
      updatedAt: "2026-05-20T00:00:00.000Z",
    };
    const waitingOnAuthor = {
      ...readyToMerge,
      number: 2,
      reference: "acme/repo#2",
      title: "Fix app value",
    };

    const state = prReducer(
      undefined,
      prActions.fetchWaitingPullRequestsSucceeded({
        readyToMerge: [readyToMerge],
        waitingOnAuthor: [waitingOnAuthor],
      }),
    );

    expect(state.readyToMergePullRequests).toEqual([readyToMerge]);
    expect(state.waitingOnAuthorPullRequests).toEqual([waitingOnAuthor]);
    expect(state.waitingError).toBeNull();
    expect(state.waitingStatus).toBe("succeeded");
  });

  it("records waiting pull request failures", () => {
    const state = prReducer(
      undefined,
      prActions.fetchWaitingPullRequestsFailed({ code: "rate_limited", message: "Slow down." }),
    );

    expect(state.waitingStatus).toBe("failed");
    expect(state.waitingError).toEqual({ code: "rate_limited", message: "Slow down." });
  });

  it("stores the selected PR list mode", () => {
    const state = prReducer(undefined, prActions.setPrListMode("mine"));

    expect(state.prListMode).toBe("mine");
  });
});
