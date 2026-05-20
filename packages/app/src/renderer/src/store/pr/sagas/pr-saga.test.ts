import { call, put } from "redux-saga/effects";
import { describe, expect, it } from "vitest";

import {
  fetchOpenPullRequestsFromGitHub,
  fetchPullRequestFromGitHub,
} from "../../../services/github";
import { prActions } from "../pr-slice";
import type { PullRequestData, PullRequestSummary } from "../pr-types";
import { fetchOpenPullRequestsSaga, fetchPrSaga } from "./pr-saga";

const pullRequest: PullRequestData = {
  diff: "diff --git a/src/app.ts b/src/app.ts",
  files: [],
  metadata: {
    author: { avatarUrl: null, login: "octocat", url: "" },
    body: "Adds app value.",
    createdAt: "2026-05-20T00:00:00.000Z",
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
  htmlUrl: "https://github.com/acme/repo/pull/1",
  number: 1,
  owner: "acme",
  reference: "acme/repo#1",
  repo: "repo",
  repositoryName: "acme/repo",
  title: "Add app value",
  updatedAt: "2026-05-20T00:00:00.000Z",
};

describe("prSaga", () => {
  it("fetches one pull request", () => {
    const generator = fetchPrSaga(prActions.fetchPr("acme/repo#1"));

    expect(generator.next().value).toEqual(call(fetchPullRequestFromGitHub, "acme/repo#1"));
    expect(generator.next(pullRequest).value).toEqual(put(prActions.fetchPrSucceeded(pullRequest)));
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
});
