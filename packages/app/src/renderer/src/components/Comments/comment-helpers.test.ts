import { describe, expect, it } from "vitest";

import {
  buildLocalReply,
  buildLocalThread,
  DEFAULT_USER_AUTHOR,
  formatRelativeTime,
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
