import type { EventChannel } from "redux-saga";
import { call, put, select, take } from "redux-saga/effects";
import { describe, expect, it, vi } from "vitest";

import {
  buildWalkthroughAgentRequest,
  type WalkthroughAgentEvent,
} from "../../../services/walkthrough-agent";
import { selectPrData } from "../../pr/pr-selectors";
import type { PullRequestData } from "../../pr/pr-types";
import { selectWalkthroughContent } from "../walkthrough-selectors";
import { walkthroughActions } from "../walkthrough-slice";
import {
  createWalkthroughAgentChannel,
  generateWalkthroughSaga,
  loadCachedWalkthroughSaga,
  loadWalkthroughFromDisk,
  saveWalkthroughToDisk,
} from "./walkthrough-saga";

const pullRequest: PullRequestData = {
  diff: "diff --git a/src/app.ts b/src/app.ts",
  files: [
    {
      additions: 1,
      changes: 1,
      deletions: 0,
      filename: "src/app.ts",
      patch: "+export const value = 1;",
      status: "modified",
    },
  ],
  metadata: {
    author: { avatarUrl: null, login: "octocat", url: "" },
    body: "Adds app value.",
    createdAt: "2026-05-20T00:00:00.000Z",
    htmlUrl: "https://github.com/acme/repo/pull/1",
    labels: ["feature"],
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

describe("generateWalkthroughSaga", () => {
  it("fails when no PR data is loaded", () => {
    const generator = generateWalkthroughSaga();

    expect(generator.next().value).toEqual(select(selectPrData));
    expect(generator.next(null).value).toEqual(
      put(walkthroughActions.generateWalkthroughFailed("Fetch a pull request first.")),
    );
    expect(generator.next().done).toBe(true);
  });

  it("streams chunks and completes", () => {
    const channel = createFakeChannel();
    const request = buildWalkthroughAgentRequest(pullRequest);
    const generator = generateWalkthroughSaga();

    expect(generator.next().value).toEqual(select(selectPrData));
    expect(generator.next(pullRequest).value).toEqual(call(createWalkthroughAgentChannel, request));
    expect(generator.next(channel).value).toEqual(take(channel));
    expect(generator.next({ content: "Hello", type: "chunk" }).value).toEqual(
      put(walkthroughActions.appendWalkthroughChunk("Hello")),
    );
    expect(generator.next().value).toEqual(take(channel));
    expect(generator.next({ type: "done" }).value).toEqual(
      put(walkthroughActions.generateWalkthroughSucceeded()),
    );
    expect(generator.next().value).toEqual(select(selectWalkthroughContent));
    expect(generator.next("Hello").value).toEqual(
      call(saveWalkthroughToDisk, "acme/repo#1", "Hello"),
    );
    expect(generator.next().done).toBe(true);
    expect(channel.close).toHaveBeenCalledOnce();
  });

  it("surfaces stream errors", () => {
    const channel = createFakeChannel();
    const request = buildWalkthroughAgentRequest(pullRequest);
    const generator = generateWalkthroughSaga();

    expect(generator.next().value).toEqual(select(selectPrData));
    expect(generator.next(pullRequest).value).toEqual(call(createWalkthroughAgentChannel, request));
    expect(generator.next(channel).value).toEqual(take(channel));
    expect(generator.next({ error: "Auth failed", type: "error" }).value).toEqual(
      put(walkthroughActions.generateWalkthroughFailed("Auth failed")),
    );
    expect(generator.next().done).toBe(true);
    expect(channel.close).toHaveBeenCalledOnce();
  });

  it("surfaces channel creation errors", () => {
    const request = buildWalkthroughAgentRequest(pullRequest);
    const generator = generateWalkthroughSaga();

    expect(generator.next().value).toEqual(select(selectPrData));
    expect(generator.next(pullRequest).value).toEqual(call(createWalkthroughAgentChannel, request));
    expect(generator.throw(new Error("Walkthrough agent API is unavailable.")).value).toEqual(
      put(walkthroughActions.generateWalkthroughFailed("Walkthrough agent API is unavailable.")),
    );
    expect(generator.next().done).toBe(true);
  });

  it("surfaces unknown walkthrough generation failures", () => {
    const request = buildWalkthroughAgentRequest(pullRequest);
    const generator = generateWalkthroughSaga();

    expect(generator.next().value).toEqual(select(selectPrData));
    expect(generator.next(pullRequest).value).toEqual(call(createWalkthroughAgentChannel, request));
    expect(generator.throw("failed").value).toEqual(
      put(walkthroughActions.generateWalkthroughFailed("Walkthrough generation failed.")),
    );
    expect(generator.next().done).toBe(true);
  });
});

describe("loadCachedWalkthroughSaga", () => {
  it("returns to idle when no PR data is loaded", () => {
    const generator = loadCachedWalkthroughSaga();

    expect(generator.next().value).toEqual(select(selectPrData));
    expect(generator.next(null).value).toEqual(
      put(walkthroughActions.loadCachedWalkthroughNotFound()),
    );
    expect(generator.next().done).toBe(true);
  });

  it("loads cached walkthrough content", () => {
    const generator = loadCachedWalkthroughSaga();

    expect(generator.next().value).toEqual(select(selectPrData));
    expect(generator.next(pullRequest).value).toEqual(call(loadWalkthroughFromDisk, "acme/repo#1"));
    expect(generator.next("Cached walkthrough").value).toEqual(
      put(walkthroughActions.loadCachedWalkthroughSucceeded("Cached walkthrough")),
    );
    expect(generator.next().done).toBe(true);
  });

  it("starts walkthrough generation when cached walkthrough is missing", () => {
    const generator = loadCachedWalkthroughSaga();

    expect(generator.next().value).toEqual(select(selectPrData));
    expect(generator.next(pullRequest).value).toEqual(call(loadWalkthroughFromDisk, "acme/repo#1"));
    expect(generator.next(null).value).toEqual(
      put(walkthroughActions.loadCachedWalkthroughNotFound()),
    );
    expect(generator.next().value).toEqual(put(walkthroughActions.generateWalkthrough()));
    expect(generator.next().done).toBe(true);
  });
});

const createFakeChannel = (): EventChannel<WalkthroughAgentEvent> =>
  ({
    close: vi.fn(),
    flush: vi.fn(),
    take: vi.fn(),
  }) as unknown as EventChannel<WalkthroughAgentEvent>;
