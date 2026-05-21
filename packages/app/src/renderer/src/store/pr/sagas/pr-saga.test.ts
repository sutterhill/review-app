import { call, put, select } from "redux-saga/effects";
import { describe, expect, it } from "vitest";

import {
  GitHubApiError,
  fetchMyPullRequestsFromGitHub,
  fetchOpenPullRequestsFromGitHub,
  fetchPullRequestComments,
  fetchPullRequestFromGitHub,
} from "../../../services/github";
import { generateLocalDiff } from "../../../services/repo-manager";
import { selectRepoEntries } from "../../repos/repos-selectors";
import { selectPrReference } from "../pr-selectors";
import { prActions } from "../pr-slice";
import type { PullRequestComment, PullRequestData, PullRequestSummary } from "../pr-types";
import {
  fetchCommentsSaga,
  fetchMyPullRequestsSaga,
  fetchOpenPullRequestsSaga,
  fetchPrSaga,
} from "./pr-saga";

const pullRequest: PullRequestData = {
  diff: "diff --git a/src/app.ts b/src/app.ts",
  files: [],
  metadata: {
    author: { avatarUrl: null, login: "octocat", url: "" },
    baseSha: "base-sha",
    body: "Adds app value.",
    createdAt: "2026-05-20T00:00:00.000Z",
    headRefName: "feature-branch",
    headSha: "head-sha",
    htmlUrl: "https://github.com/acme/repo/pull/1",
    labels: [],
    number: 1,
    owner: "acme",
    reference: "acme/repo#1",
    repo: "repo",
    reviewers: [],
    state: "open",
    title: "Add app value",
    updatedAt: "2026-05-20T00:00:00.000Z",
  },
};

const summary: PullRequestSummary = {
  author: { avatarUrl: null, login: "octocat", url: "" },
  headRefName: "feature-branch",
  htmlUrl: "https://github.com/acme/repo/pull/1",
  number: 1,
  owner: "acme",
  reference: "acme/repo#1",
  repo: "repo",
  repositoryName: "acme/repo",
  title: "Add app value",
  updatedAt: "2026-05-20T00:00:00.000Z",
};

const comment: PullRequestComment = {
  author: { avatarUrl: null, login: "reviewer", url: "" },
  body: "Looks good.",
  createdAt: "2026-05-21T00:00:00.000Z",
  id: 100,
  updatedAt: "2026-05-21T00:00:00.000Z",
};

describe("prSaga", () => {
  it("fetches one pull request", () => {
    const generator = fetchPrSaga(prActions.fetchPr("acme/repo#1"));

    expect(generator.next().value).toEqual(call(fetchPullRequestFromGitHub, "acme/repo#1"));
    expect(generator.next(pullRequest).value).toEqual(put(prActions.fetchPrSucceeded(pullRequest)));
    expect(generator.next().done).toBe(true);
  });

  it("falls back to local diff when the GitHub diff is empty", () => {
    const generator = fetchPrSaga(prActions.fetchPr("acme/repo#1"));
    const pullRequestWithoutDiff = { ...pullRequest, diff: "" };
    const localDiff = "diff --git a/src/local.ts b/src/local.ts";

    expect(generator.next().value).toEqual(call(fetchPullRequestFromGitHub, "acme/repo#1"));
    expect(generator.next(pullRequestWithoutDiff).value).toEqual(select(selectRepoEntries));
    expect(
      generator.next({
        "acme/repo": {
          error: null,
          fullName: "acme/repo",
          localPath: "/repos/acme/repo",
          status: "ready",
          worktrees: null,
        },
      }).value,
    ).toEqual(call(generateLocalDiff, "/repos/acme/repo", "base-sha", "head-sha"));
    expect(generator.next(localDiff).value).toEqual(
      put(prActions.fetchPrSucceeded({ ...pullRequestWithoutDiff, diff: localDiff })),
    );
    expect(generator.next().done).toBe(true);
  });

  it("prefers a worktree matching the pull request head branch for local diff fallback", () => {
    const generator = fetchPrSaga(prActions.fetchPr("acme/repo#1"));
    const pullRequestWithoutDiff = { ...pullRequest, diff: "" };
    const localDiff = "diff --git a/src/worktree.ts b/src/worktree.ts";

    expect(generator.next().value).toEqual(call(fetchPullRequestFromGitHub, "acme/repo#1"));
    expect(generator.next(pullRequestWithoutDiff).value).toEqual(select(selectRepoEntries));
    expect(
      generator.next({
        "acme/repo": {
          error: null,
          fullName: "acme/repo",
          localPath: "/repos/acme/repo",
          status: "ready",
          worktrees: [{ branch: "feature-branch", path: "/repos/acme/repo-feature" }],
        },
      }).value,
    ).toEqual(call(generateLocalDiff, "/repos/acme/repo-feature", "base-sha", "head-sha"));
    expect(generator.next(localDiff).value).toEqual(
      put(prActions.fetchPrSucceeded({ ...pullRequestWithoutDiff, diff: localDiff })),
    );
    expect(generator.next().done).toBe(true);
  });

  it("fetches open pull request summaries", () => {
    const generator = fetchOpenPullRequestsSaga();

    expect(generator.next().value).toEqual(call(fetchOpenPullRequestsFromGitHub));
    expect(generator.next([summary]).value).toEqual(
      put(prActions.fetchOpenPullRequestsSucceeded([summary])),
    );
    expect(generator.next().done).toBe(true);
  });

  it("fetches my pull request summaries", () => {
    const generator = fetchMyPullRequestsSaga();

    expect(generator.next().value).toEqual(call(fetchMyPullRequestsFromGitHub));
    expect(generator.next([summary]).value).toEqual(
      put(prActions.fetchMyPullRequestsSucceeded([summary])),
    );
    expect(generator.next().done).toBe(true);
  });

  it("fetches pull request comments for the current reference", () => {
    const generator = fetchCommentsSaga();

    expect(generator.next().value).toEqual(select(selectPrReference));
    expect(generator.next("acme/repo#1").value).toEqual(
      call(fetchPullRequestComments, "acme/repo#1"),
    );
    expect(generator.next([comment]).value).toEqual(
      put(prActions.fetchCommentsSucceeded([comment])),
    );
    expect(generator.next().done).toBe(true);
  });

  it("surfaces pull request fetch network failures", () => {
    const generator = fetchPrSaga(prActions.fetchPr("acme/repo#1"));

    expect(generator.next().value).toEqual(call(fetchPullRequestFromGitHub, "acme/repo#1"));
    expect(generator.throw(new Error("Network offline")).value).toEqual(
      put(prActions.fetchPrFailed({ code: "network", message: "Network offline" })),
    );
    expect(generator.next().done).toBe(true);
  });

  it("preserves GitHub API error details", () => {
    const generator = fetchOpenPullRequestsSaga();

    expect(generator.next().value).toEqual(call(fetchOpenPullRequestsFromGitHub));
    expect(generator.throw(new GitHubApiError("rate_limited", "Slow down.", 403)).value).toEqual(
      put(
        prActions.fetchOpenPullRequestsFailed({
          code: "rate_limited",
          message: "Slow down.",
          status: 403,
        }),
      ),
    );
    expect(generator.next().done).toBe(true);
  });
});
