import { describe, expect, it } from "vitest";

import { commentsActions, commentsReducer } from "./comments-slice";
import type { Comment, CommentThread } from "./comments-types";

const REF = "acme/repo#1";

const makeThread = (overrides: Partial<CommentThread> = {}): CommentThread => ({
  comments: [
    {
      author: { avatarUrl: null, kind: "user", login: "alice" },
      body: "hi",
      createdAt: "2026-05-21T00:00:00.000Z",
      id: "c1",
      source: "local",
      threadId: "t1",
    },
  ],
  filePath: "src/a.ts",
  id: "t1",
  lineRange: [10, 10],
  prReference: REF,
  resolved: false,
  side: "new",
  source: "local",
  ...overrides,
});

const makeReply = (overrides: Partial<Comment> = {}): Comment => ({
  author: { avatarUrl: null, kind: "user", login: "bob" },
  body: "reply",
  createdAt: "2026-05-21T00:01:00.000Z",
  id: "c2",
  source: "local",
  threadId: "t1",
  ...overrides,
});

describe("commentsReducer", () => {
  it("starts with empty serializable state", () => {
    const state = commentsReducer(undefined, { type: "unknown" });
    expect(state).toEqual({
      byReference: {},
      currentUser: null,
      replyByThread: {},
      reviewByReference: {},
    });
    expect(() => JSON.stringify(state)).not.toThrow();
  });

  it("adds a local thread", () => {
    const thread = makeThread();
    const state = commentsReducer(
      undefined,
      commentsActions.addLocalThread({ prReference: REF, thread }),
    );
    expect(state.byReference[REF]?.local).toEqual([thread]);
    expect(state.byReference[REF]?.github).toEqual([]);
  });

  it("does not duplicate a thread with the same id", () => {
    const thread = makeThread();
    let state = commentsReducer(
      undefined,
      commentsActions.addLocalThread({ prReference: REF, thread }),
    );
    state = commentsReducer(state, commentsActions.addLocalThread({ prReference: REF, thread }));
    expect(state.byReference[REF]?.local).toHaveLength(1);
  });

  it("appends a reply to a local thread", () => {
    const thread = makeThread();
    let state = commentsReducer(
      undefined,
      commentsActions.addLocalThread({ prReference: REF, thread }),
    );
    const reply = makeReply();
    state = commentsReducer(
      state,
      commentsActions.addLocalReply({ comment: reply, prReference: REF, threadId: thread.id }),
    );
    expect(state.byReference[REF]?.local[0]?.comments).toHaveLength(2);
  });

  it("does not duplicate a reply with the same id", () => {
    const thread = makeThread();
    let state = commentsReducer(
      undefined,
      commentsActions.addLocalThread({ prReference: REF, thread }),
    );
    const reply = makeReply();
    state = commentsReducer(
      state,
      commentsActions.addLocalReply({ comment: reply, prReference: REF, threadId: thread.id }),
    );
    state = commentsReducer(
      state,
      commentsActions.addLocalReply({ comment: reply, prReference: REF, threadId: thread.id }),
    );
    expect(state.byReference[REF]?.local[0]?.comments).toHaveLength(2);
  });

  it("removes a local thread", () => {
    const thread = makeThread();
    let state = commentsReducer(
      undefined,
      commentsActions.addLocalThread({ prReference: REF, thread }),
    );
    state = commentsReducer(
      state,
      commentsActions.removeLocalThread({ prReference: REF, threadId: thread.id }),
    );
    expect(state.byReference[REF]?.local).toEqual([]);
  });

  it("hydrates local and github threads separately", () => {
    const local = [makeThread()];
    const github = [makeThread({ id: "g1", source: "github" })];
    let state = commentsReducer(
      undefined,
      commentsActions.hydrateLocalThreads({ prReference: REF, threads: local }),
    );
    state = commentsReducer(
      state,
      commentsActions.hydrateGithubThreads({ prReference: REF, threads: github }),
    );
    expect(state.byReference[REF]?.local).toEqual(local);
    expect(state.byReference[REF]?.github).toEqual(github);
  });

  it("toggles resolved on a local thread", () => {
    const thread = makeThread();
    let state = commentsReducer(
      undefined,
      commentsActions.addLocalThread({ prReference: REF, thread }),
    );
    state = commentsReducer(
      state,
      commentsActions.setResolved({ prReference: REF, resolved: true, threadId: thread.id }),
    );
    expect(state.byReference[REF]?.local[0]?.resolved).toBe(true);
  });

  it("stores the current user", () => {
    const state = commentsReducer(
      undefined,
      commentsActions.setCurrentUser({
        author: { avatarUrl: null, kind: "user", login: "alice" },
      }),
    );
    expect(state.currentUser?.login).toBe("alice");
  });

  it("tracks review status transitions", () => {
    let state = commentsReducer(undefined, commentsActions.reviewStarted({ prReference: REF }));
    expect(state.reviewByReference[REF]?.status).toBe("running");
    state = commentsReducer(state, commentsActions.reviewSucceeded({ prReference: REF }));
    expect(state.reviewByReference[REF]?.status).toBe("idle");
    state = commentsReducer(
      state,
      commentsActions.reviewFailed({ error: "boom", prReference: REF }),
    );
    expect(state.reviewByReference[REF]?.status).toBe("failed");
    expect(state.reviewByReference[REF]?.error).toBe("boom");
  });

  it("replaces agent threads while preserving user-authored local threads", () => {
    const userThread = makeThread({ id: "user-1" });
    const agentThread = makeThread({
      category: "warning",
      comments: [
        {
          author: { avatarUrl: null, kind: "agent", login: "agent" },
          body: "watch out",
          category: "warning",
          createdAt: "2026-05-21T00:02:00.000Z",
          id: "agent-c1",
          source: "local",
          threadId: "agent-1",
        },
      ],
      id: "agent-1",
    });
    let state = commentsReducer(
      undefined,
      commentsActions.addLocalThread({ prReference: REF, thread: userThread }),
    );
    state = commentsReducer(
      state,
      commentsActions.replaceAgentThreads({ prReference: REF, threads: [agentThread] }),
    );
    expect(state.byReference[REF]?.local.map((t) => t.id)).toEqual(["user-1", "agent-1"]);

    const replacement = makeThread({
      category: "nit",
      comments: [
        {
          author: { avatarUrl: null, kind: "agent", login: "agent" },
          body: "tiny",
          category: "nit",
          createdAt: "2026-05-21T00:03:00.000Z",
          id: "agent-c2",
          source: "local",
          threadId: "agent-2",
        },
      ],
      id: "agent-2",
    });
    state = commentsReducer(
      state,
      commentsActions.replaceAgentThreads({ prReference: REF, threads: [replacement] }),
    );
    expect(state.byReference[REF]?.local.map((t) => t.id)).toEqual(["user-1", "agent-2"]);
  });

  it("clearAgentThreads removes only agent-authored threads and resets review status", () => {
    const userThread = makeThread({ id: "user-1" });
    const agentThread = makeThread({
      category: "warning",
      comments: [
        {
          author: { avatarUrl: null, kind: "agent", login: "agent" },
          body: "watch out",
          category: "warning",
          createdAt: "2026-05-21T00:02:00.000Z",
          id: "agent-c1",
          source: "local",
          threadId: "agent-1",
        },
      ],
      id: "agent-1",
    });
    let state = commentsReducer(
      undefined,
      commentsActions.addLocalThread({ prReference: REF, thread: userThread }),
    );
    state = commentsReducer(
      state,
      commentsActions.replaceAgentThreads({ prReference: REF, threads: [agentThread] }),
    );
    state = commentsReducer(state, commentsActions.reviewFailed({ error: "x", prReference: REF }));
    expect(state.byReference[REF]?.local.map((t) => t.id)).toEqual(["user-1", "agent-1"]);
    state = commentsReducer(state, commentsActions.clearAgentThreads({ prReference: REF }));
    expect(state.byReference[REF]?.local.map((t) => t.id)).toEqual(["user-1"]);
    expect(state.reviewByReference[REF]).toBeUndefined();
  });

  it("clearAgentThreads is a no-op when the bucket is missing", () => {
    const state = commentsReducer(
      undefined,
      commentsActions.clearAgentThreads({ prReference: REF }),
    );
    expect(state.byReference[REF]).toBeUndefined();
  });

  it("tracks per-thread agent reply transitions", () => {
    let state = commentsReducer(undefined, commentsActions.agentReplyStarted({ threadId: "t1" }));
    expect(state.replyByThread["t1"]?.status).toBe("running");
    state = commentsReducer(state, commentsActions.agentReplySucceeded({ threadId: "t1" }));
    expect(state.replyByThread["t1"]?.status).toBe("idle");
    state = commentsReducer(
      state,
      commentsActions.agentReplyFailed({ error: "nope", threadId: "t1" }),
    );
    expect(state.replyByThread["t1"]?.status).toBe("failed");
    expect(state.replyByThread["t1"]?.error).toBe("nope");
  });
});
