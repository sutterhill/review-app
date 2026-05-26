import { describe, expect, it } from "vitest";

import type { CommentThread } from "../../store/comments/comments-types";
import {
  buildLocalReply,
  buildLocalThread,
  DEFAULT_USER_AUTHOR,
  formatRelativeTime,
  formatThreadContextForClipboard,
} from "./comment-helpers";

describe("buildLocalThread", () => {
  it("creates a thread with a single seeded comment", () => {
    const thread = buildLocalThread({
      author: DEFAULT_USER_AUTHOR,
      body: "first comment",
      filePath: "src/a.ts",
      lineRange: [10, 12],
      prReference: "acme/repo#1",
    });
    expect(thread.filePath).toBe("src/a.ts");
    expect(thread.lineRange).toEqual([10, 12]);
    expect(thread.side).toBe("new");
    expect(thread.source).toBe("local");
    expect(thread.comments).toHaveLength(1);
    expect(thread.comments[0]?.body).toBe("first comment");
    expect(thread.comments[0]?.threadId).toBe(thread.id);
    expect(thread.resolved).toBe(false);
  });
});

describe("buildLocalReply", () => {
  it("creates a reply linked to a thread", () => {
    const reply = buildLocalReply({
      author: DEFAULT_USER_AUTHOR,
      body: "ack",
      threadId: "thread-abc",
    });
    expect(reply.threadId).toBe("thread-abc");
    expect(reply.body).toBe("ack");
    expect(reply.source).toBe("local");
    expect(typeof reply.id).toBe("string");
  });
});

describe("formatRelativeTime", () => {
  const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

  it("returns 'just now' for a recent timestamp", () => {
    expect(formatRelativeTime(new Date(NOW - 5_000).toISOString(), NOW)).toBe("just now");
  });

  it("returns minutes ago for sub-hour deltas", () => {
    expect(formatRelativeTime(new Date(NOW - 10 * 60_000).toISOString(), NOW)).toBe("10m ago");
  });

  it("returns hours ago for sub-day deltas", () => {
    expect(formatRelativeTime(new Date(NOW - 3 * 60 * 60_000).toISOString(), NOW)).toBe("3h ago");
  });

  it("returns days ago for sub-month deltas", () => {
    expect(formatRelativeTime(new Date(NOW - 2 * 24 * 60 * 60_000).toISOString(), NOW)).toBe(
      "2d ago",
    );
  });

  it("returns an empty string for invalid timestamps", () => {
    expect(formatRelativeTime("not-a-date", NOW)).toBe("");
  });
});

describe("formatThreadContextForClipboard", () => {
  const baseThread: CommentThread = {
    comments: [
      {
        author: { avatarUrl: null, kind: "user", login: "alice" },
        body: "Looks suspicious",
        createdAt: "2026-05-21T00:00:00.000Z",
        id: "c1",
        source: "local",
        threadId: "t1",
      },
      {
        author: { avatarUrl: null, kind: "agent", login: "review-bot" },
        body: "Here is a suggestion",
        createdAt: "2026-05-21T00:05:00.000Z",
        id: "c2",
        source: "local",
        threadId: "t1",
      },
    ],
    filePath: "src/foo.ts",
    id: "t1",
    lineRange: [10, 12],
    prReference: "acme/repo#7",
    resolved: false,
    side: "new",
    source: "local",
  };

  it("includes PR, file path, line range, side, and all comments", () => {
    const out = formatThreadContextForClipboard(baseThread);
    expect(out).toContain("PR: acme/repo#7");
    expect(out).toContain("File: src/foo.ts (lines 10-12)");
    expect(out).toContain("Side: new (after)");
    expect(out).toContain("@alice:\nLooks suspicious");
    expect(out).toContain("@review-bot (agent):\nHere is a suggestion");
  });

  it("uses singular line label when start equals end", () => {
    const out = formatThreadContextForClipboard({ ...baseThread, lineRange: [10, 10] });
    expect(out).toContain("(line 10)");
  });

  it("appends a GitHub URL when present", () => {
    const out = formatThreadContextForClipboard({
      ...baseThread,
      githubUrl: "https://github.com/acme/repo/pull/7#discussion_r1",
    });
    expect(out).toContain("URL: https://github.com/acme/repo/pull/7#discussion_r1");
  });
});
