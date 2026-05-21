import type { EventChannel } from "redux-saga";
import { call, put, select, take } from "redux-saga/effects";
import { describe, expect, it, vi } from "vitest";

import {
  buildWalkthroughAgentRequest,
  type WalkthroughAgentEvent,
} from "../../../services/walkthrough-agent";
import { selectPrData } from "../../pr/pr-selectors";
import type { PullRequestData } from "../../pr/pr-types";
import { selectWalkthroughMessages } from "../walkthrough-selectors";
import { walkthroughActions } from "../walkthrough-slice";
import type { WalkthroughMessage, WalkthroughResponse } from "../walkthrough-types";
import {
  askFollowUpSaga,
  createWalkthroughAgentChannel,
  generateWalkthroughSaga,
  loadCachedWalkthroughSaga,
  loadWalkthroughFromDisk,
  saveWalkthroughToDisk,
  streamWalkthroughMessageSaga,
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
    baseSha: "base-sha",
    body: "Adds app value.",
    createdAt: "2026-05-20T00:00:00.000Z",
    headRefName: "feature-branch",
    headSha: "head-sha",
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

const partialResponse = { description: "hi" } as unknown as WalkthroughResponse;

const createFakeChannel = (): EventChannel<WalkthroughAgentEvent> =>
  ({
    close: vi.fn(),
    flush: vi.fn(),
    take: vi.fn(),
  }) as unknown as EventChannel<WalkthroughAgentEvent>;

describe("generateWalkthroughSaga", () => {
  it("fails when no PR data is loaded", () => {
    const generator = generateWalkthroughSaga();
    expect(generator.next().value).toEqual(select(selectPrData));
    const next = generator.next(null).value;
    expect(next).toMatchObject(
      put(walkthroughActions.messageFailed({ error: "Fetch a pull request first.", id: "none" })),
    );
    expect(generator.next().done).toBe(true);
  });

  it("starts an initial message and delegates to the stream saga", () => {
    const generator = generateWalkthroughSaga();
    expect(generator.next().value).toEqual(select(selectPrData));
    const startedEffect = generator.next(pullRequest).value as {
      payload: { action: { payload: { id: string } } };
    };
    const messageId = startedEffect.payload.action.payload.id;
    expect(messageId).toMatch(/^initial-/u);
    const request = buildWalkthroughAgentRequest(pullRequest);
    expect(generator.next().value).toEqual(
      call(streamWalkthroughMessageSaga, pullRequest, request, messageId),
    );
    expect(generator.next().done).toBe(true);
  });
});

describe("streamWalkthroughMessageSaga", () => {
  it("streams chunks, parses partial JSON, and saves to disk", () => {
    const channel = createFakeChannel();
    const request = buildWalkthroughAgentRequest(pullRequest);
    const generator = streamWalkthroughMessageSaga(pullRequest, request, "m1");
    expect(generator.next().value).toEqual(call(createWalkthroughAgentChannel, request));
    expect(generator.next(channel).value).toEqual(take(channel));

    const chunkEffect = generator.next({ content: '{"description":"hi"}', type: "chunk" })
      .value as ReturnType<typeof put>;
    expect(chunkEffect).toMatchObject(
      put(
        walkthroughActions.appendMessageChunk({
          chunk: '{"description":"hi"}',
          id: "m1",
          parsed: partialResponse,
        }),
      ),
    );
    expect(generator.next().value).toEqual(take(channel));

    expect(generator.next({ type: "done" }).value).toEqual(
      put(walkthroughActions.messageSucceeded({ id: "m1", parsed: partialResponse })),
    );
    expect(generator.next().value).toEqual(select(selectWalkthroughMessages));
    const sampleMessages: WalkthroughMessage[] = [
      { id: "m1", kind: "initial", parsed: null, raw: '{"description":"hi"}', status: "succeeded" },
    ];
    expect(generator.next(sampleMessages).value).toEqual(
      call(saveWalkthroughToDisk, "acme/repo#1", JSON.stringify(sampleMessages)),
    );
    expect(generator.next().done).toBe(true);
    expect(channel.close).toHaveBeenCalledOnce();
  });

  it("surfaces stream errors", () => {
    const channel = createFakeChannel();
    const request = buildWalkthroughAgentRequest(pullRequest);
    const generator = streamWalkthroughMessageSaga(pullRequest, request, "m1");
    expect(generator.next().value).toEqual(call(createWalkthroughAgentChannel, request));
    expect(generator.next(channel).value).toEqual(take(channel));
    expect(generator.next({ error: "Auth failed", type: "error" }).value).toEqual(
      put(walkthroughActions.messageFailed({ error: "Auth failed", id: "m1" })),
    );
    expect(generator.next().done).toBe(true);
    expect(channel.close).toHaveBeenCalledOnce();
  });
});

describe("askFollowUpSaga", () => {
  it("includes prior messages as history", () => {
    const generator = askFollowUpSaga(
      walkthroughActions.askFollowUp({ id: "m2", question: "why?" }),
    );
    expect(generator.next().value).toEqual(select(selectPrData));
    expect(generator.next(pullRequest).value).toEqual(select(selectWalkthroughMessages));
    const prior: WalkthroughMessage[] = [
      { id: "m1", kind: "initial", parsed: null, raw: '{"description":"hi"}', status: "succeeded" },
    ];
    const effect = generator.next(prior).value as ReturnType<typeof call>;
    const request = buildWalkthroughAgentRequest(pullRequest, {
      followUpQuestion: "why?",
      history: [{ question: "", responseJson: '{"description":"hi"}' }],
    });
    expect(effect).toEqual(call(streamWalkthroughMessageSaga, pullRequest, request, "m2"));
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

  it("regenerates when cache is missing", () => {
    const generator = loadCachedWalkthroughSaga();
    expect(generator.next().value).toEqual(select(selectPrData));
    expect(generator.next(pullRequest).value).toEqual(call(loadWalkthroughFromDisk, "acme/repo#1"));
    expect(generator.next(null).value).toEqual(
      put(walkthroughActions.loadCachedWalkthroughNotFound()),
    );
    expect(generator.next().value).toEqual(put(walkthroughActions.generateWalkthrough()));
    expect(generator.next().done).toBe(true);
  });

  it("regenerates when cache is invalid JSON", () => {
    const generator = loadCachedWalkthroughSaga();
    expect(generator.next().value).toEqual(select(selectPrData));
    expect(generator.next(pullRequest).value).toEqual(call(loadWalkthroughFromDisk, "acme/repo#1"));
    expect(generator.next("not json").value).toEqual(
      put(walkthroughActions.loadCachedWalkthroughNotFound()),
    );
    expect(generator.next().value).toEqual(put(walkthroughActions.generateWalkthrough()));
    expect(generator.next().done).toBe(true);
  });

  it("loads cached messages when valid", () => {
    const generator = loadCachedWalkthroughSaga();
    const cached: WalkthroughMessage[] = [
      {
        id: "m1",
        kind: "initial",
        parsed: { description: "x", groups: [], steps: [], suggestedQuestions: [] },
        raw: "{}",
        status: "succeeded",
      },
    ];
    expect(generator.next().value).toEqual(select(selectPrData));
    expect(generator.next(pullRequest).value).toEqual(call(loadWalkthroughFromDisk, "acme/repo#1"));
    expect(generator.next(JSON.stringify(cached)).value).toEqual(
      put(walkthroughActions.loadCachedWalkthroughSucceeded({ messages: cached })),
    );
    expect(generator.next().done).toBe(true);
  });
});
