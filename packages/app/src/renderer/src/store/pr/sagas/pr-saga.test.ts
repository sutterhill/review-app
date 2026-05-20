import { call, put } from "redux-saga/effects";
import { describe, expect, it } from "vitest";

import { GitHubApiError, fetchPullRequestFromGitHub } from "../../../services/github";
import { prActions } from "../pr-slice";
import type { PullRequestData } from "../pr-types";
import { fetchPrSaga } from "./pr-saga";

const pullRequestData: PullRequestData = {
  diff: "diff --git a/file.ts b/file.ts",
  files: [],
  metadata: {
    author: { avatarUrl: null, login: "author", url: "" },
    body: "Body",
    createdAt: "2026-05-20T00:00:00Z",
    htmlUrl: "https://github.com/owner/repo/pull/1",
    labels: [],
    number: 1,
    owner: "owner",
    reference: "owner/repo#1",
    repo: "repo",
    reviewers: [],
    state: "open",
    title: "Title",
    updatedAt: "2026-05-20T00:00:00Z",
  },
};

describe("fetchPrSaga", () => {
  it("fetches and stores PR data", () => {
    const generator = fetchPrSaga(prActions.fetchPr("owner/repo#1"));

    expect(generator.next().value).toEqual(call(fetchPullRequestFromGitHub, "owner/repo#1"));
    expect(generator.next(pullRequestData).value).toEqual(
      put(prActions.fetchPrSucceeded(pullRequestData)),
    );
    expect(generator.next().done).toBe(true);
  });

  it("maps GitHub API failures into Redux errors", () => {
    const generator = fetchPrSaga(prActions.fetchPr("owner/repo#1"));

    generator.next();

    expect(generator.throw(new GitHubApiError("not_found", "Missing PR", 404)).value).toEqual(
      put(prActions.fetchPrFailed({ code: "not_found", message: "Missing PR", status: 404 })),
    );
  });
});
