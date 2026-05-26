import { eventChannel, type EventChannel } from "redux-saga";
import { call, put, select, take } from "redux-saga/effects";
import { describe, expect, it } from "vitest";

import { fetchPullRequestReviewComments } from "../../../services/github";
import { buildReplyAgentRequest } from "../../../services/reply-agent";
import { buildReviewAgentRequest } from "../../../services/review-agent";
import { selectPrData } from "../../pr/pr-selectors";
import type { PullRequestData } from "../../pr/pr-types";
import { selectCommentsBucket, selectThreadById } from "../comments-selectors";
import { commentsActions } from "../comments-slice";
import type { CommentThread } from "../comments-types";
import {
  createReplyAgentChannel,
  createReviewAgentChannel,
  loadCommentsSaga,
  loadLocalThreadsFromDisk,
  persistLocalThreadsSaga,
  runAgentReplySaga,
  runAgentReviewSaga,
  saveLocalThreadsToDisk,
} from "./comments-saga";

const REF = "acme/repo#1";

const makeThread = (id: string): CommentThread => ({
  comments: [
    {
      author: { avatarUrl: null, kind: "user", login: "alice" },
      body: "hi",
      createdAt: "2026-05-21T00:00:00.000Z",
      id: `${id}-c1`,
      source: "local",
      threadId: id,
    },
  ],
  filePath: "src/a.ts",
  id,
  lineRange: [10, 10],
  prReference: REF,
  resolved: false,
  side: "new",
  source: "local",
});

describe("loadCommentsSaga", () => {
  it("hydrates local then github threads", () => {
    const generator = loadCommentsSaga(commentsActions.loadComments({ prReference: REF }));
    const local = [makeThread("t1")];
    const github = [makeThread("g1")];

    expect(generator.next().value).toEqual(call(loadLocalThreadsFromDisk, REF));
    expect(generator.next(local).value).toEqual(
      put(commentsActions.hydrateLocalThreads({ prReference: REF, threads: local })),
    );
    expect(generator.next().value).toEqual(call(fetchPullRequestReviewComments, REF));
    expect(generator.next(github).value).toEqual(
      put(commentsActions.hydrateGithubThreads({ prReference: REF, threads: github })),
    );
    expect(generator.next().done).toBe(true);
  });

  it("falls back to empty github threads on fetch error", () => {
    const generator = loadCommentsSaga(commentsActions.loadComments({ prReference: REF }));

    expect(generator.next().value).toEqual(call(loadLocalThreadsFromDisk, REF));
    expect(generator.next([]).value).toEqual(
      put(commentsActions.hydrateLocalThreads({ prReference: REF, threads: [] })),
    );
    expect(generator.next().value).toEqual(call(fetchPullRequestReviewComments, REF));
    expect(generator.throw(new Error("boom")).value).toEqual(
      put(commentsActions.hydrateGithubThreads({ prReference: REF, threads: [] })),
    );
    expect(generator.next().done).toBe(true);
  });
});

describe("persistLocalThreadsSaga", () => {
  it("persists the latest local threads bucket after a thread change", () => {
    const local = [makeThread("t1")];
    const generator = persistLocalThreadsSaga(
      commentsActions.addLocalThread({ prReference: REF, thread: local[0]! }),
    );

    expect(generator.next().value).toEqual(select(selectCommentsBucket(REF)));
    expect(generator.next({ github: [], local }).value).toEqual(
      call(saveLocalThreadsToDisk, REF, local),
    );
    expect(generator.next().done).toBe(true);
  });
});

const makePrData = (): PullRequestData => ({
  diff: "",
  files: [
    {
      additions: 1,
      changes: 1,
      deletions: 0,
      filename: "src/a.ts",
      patch: "@@ -0,0 +1 @@\n+hi",
      status: "modified",
    },
  ],
  metadata: {
    author: { avatarUrl: null, login: "alice", url: "" },
    baseSha: "base-sha",
    body: "",
    createdAt: "2026-05-21T00:00:00.000Z",
    headRefName: "feature",
    headSha: "head-sha",
    htmlUrl: "",
    labels: [],
    number: 1,
    owner: "acme",
    reference: REF,
    repo: "repo",
    reviewers: [],
    state: "open",
    title: "PR",
    updatedAt: "2026-05-21T00:00:00.000Z",
  },
});

describe("runAgentReviewSaga", () => {
  it("fails fast when no PR is loaded", () => {
    const gen = runAgentReviewSaga(commentsActions.requestAgentReview({ prReference: REF }));
    expect(gen.next().value).toEqual(select(selectPrData));
    expect(gen.next(null).value).toEqual(
      put(commentsActions.reviewFailed({ error: "No pull request loaded.", prReference: REF })),
    );
    expect(gen.next().done).toBe(true);
  });

  it("streams chunks, parses the final JSON, and replaces agent threads", () => {
    const prData = makePrData();
    const request = buildReviewAgentRequest(prData);
    const gen = runAgentReviewSaga(commentsActions.requestAgentReview({ prReference: REF }));
    const channel: EventChannel<object> = eventChannel(() => () => {});

    expect(gen.next().value).toEqual(select(selectPrData));
    expect(gen.next(prData).value).toEqual(
      put(commentsActions.reviewStarted({ prReference: REF })),
    );
    expect(gen.next().value).toEqual(call(createReviewAgentChannel, request));
    expect(gen.next(channel).value).toEqual(take(channel));

    const json =
      '{"summary":"ok","comments":[{"filePath":"src/a.ts","lineStart":1,"lineEnd":1,"category":"nit","body":"tiny"}]}';
    const next = gen.next({ result: json, type: "done" } as never).value as {
      payload: {
        action: { payload: { prReference: string; threads: CommentThread[] }; type: string };
      };
    };
    expect(next.payload.action.type).toBe(commentsActions.replaceAgentThreads.type);
    expect(next.payload.action.payload.threads).toHaveLength(1);
    expect(next.payload.action.payload.threads[0]?.category).toBe("nit");
    expect(next.payload.action.payload.threads[0]?.lineRange).toEqual([1, 1]);
    expect(next.payload.action.payload.threads[0]?.filePath).toBe("src/a.ts");

    expect(gen.next().value).toEqual(put(commentsActions.reviewSucceeded({ prReference: REF })));
    expect(gen.next().done).toBe(true);
  });

  it("reports an agent error event", () => {
    const prData = makePrData();
    const gen = runAgentReviewSaga(commentsActions.requestAgentReview({ prReference: REF }));
    const channel: EventChannel<object> = eventChannel(() => () => {});

    gen.next();
    gen.next(prData);
    gen.next();
    gen.next(channel);
    expect(gen.next({ error: "boom", type: "error" } as never).value).toEqual(
      put(commentsActions.reviewFailed({ error: "boom", prReference: REF })),
    );
    expect(gen.next().done).toBe(true);
  });
});

describe("runAgentReplySaga", () => {
  it("fails when no PR is loaded", () => {
    const gen = runAgentReplySaga(
      commentsActions.requestAgentReply({ prReference: REF, threadId: "t1" }),
    );
    expect(gen.next().value).toEqual(select(selectPrData));
    expect(gen.next(null).value).toEqual(
      put(commentsActions.agentReplyFailed({ error: "No pull request loaded.", threadId: "t1" })),
    );
    expect(gen.next().done).toBe(true);
  });

  it("fails when thread is not found", () => {
    const prData = makePrData();
    const gen = runAgentReplySaga(
      commentsActions.requestAgentReply({ prReference: REF, threadId: "t1" }),
    );
    gen.next();
    expect(gen.next(prData).value).toEqual(select(selectThreadById(REF, "t1")));
    expect(gen.next(null).value).toEqual(
      put(commentsActions.agentReplyFailed({ error: "Thread not found.", threadId: "t1" })),
    );
    expect(gen.next().done).toBe(true);
  });

  it("streams chunks, parses the final result, and adds a reply", () => {
    const prData = makePrData();
    const thread = makeThread("t1");
    const request = buildReplyAgentRequest(prData, thread);
    const gen = runAgentReplySaga(
      commentsActions.requestAgentReply({ prReference: REF, threadId: thread.id }),
    );
    const channel: EventChannel<object> = eventChannel(() => () => {});

    expect(gen.next().value).toEqual(select(selectPrData));
    expect(gen.next(prData).value).toEqual(select(selectThreadById(REF, thread.id)));
    expect(gen.next(thread).value).toEqual(
      put(commentsActions.agentReplyStarted({ threadId: thread.id })),
    );
    expect(gen.next().value).toEqual(call(createReplyAgentChannel, request));
    expect(gen.next(channel).value).toEqual(take(channel));

    const result = "Thanks for the heads-up — looks safe to me.";
    const addedReply = gen.next({ result, type: "done" } as never).value as {
      payload: {
        action: { payload: { comment: { body: string }; threadId: string }; type: string };
      };
    };
    expect(addedReply.payload.action.type).toBe(commentsActions.addLocalReply.type);
    expect(addedReply.payload.action.payload.threadId).toBe(thread.id);
    expect(addedReply.payload.action.payload.comment.body).toBe(result);
    expect(gen.next().value).toEqual(
      put(commentsActions.agentReplySucceeded({ threadId: thread.id })),
    );
    expect(gen.next().done).toBe(true);
  });
});
