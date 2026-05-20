import type { EventChannel } from "redux-saga";
import { call, put, select, take } from "redux-saga/effects";
import { describe, expect, it, vi } from "vitest";

import {
  buildNarrativeAgentRequest,
  type NarrativeAgentEvent,
} from "../../../services/narrative-agent";
import { selectPrData } from "../../pr/pr-selectors";
import type { PullRequestData } from "../../pr/pr-types";
import { narrativeActions } from "../narrative-slice";
import { createNarrativeAgentChannel, generateNarrativeSaga } from "./narrative-saga";

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

describe("generateNarrativeSaga", () => {
  it("fails when no PR data is loaded", () => {
    const generator = generateNarrativeSaga();

    expect(generator.next().value).toEqual(select(selectPrData));
    expect(generator.next(null).value).toEqual(
      put(narrativeActions.generateNarrativeFailed("Fetch a pull request first.")),
    );
    expect(generator.next().done).toBe(true);
  });

  it("streams chunks and completes", () => {
    const channel = createFakeChannel();
    const request = buildNarrativeAgentRequest(pullRequest);
    const generator = generateNarrativeSaga();

    expect(generator.next().value).toEqual(select(selectPrData));
    expect(generator.next(pullRequest).value).toEqual(call(createNarrativeAgentChannel, request));
    expect(generator.next(channel).value).toEqual(take(channel));
    expect(generator.next({ content: "Hello", type: "chunk" }).value).toEqual(
      put(narrativeActions.appendNarrativeChunk("Hello")),
    );
    expect(generator.next().value).toEqual(take(channel));
    expect(generator.next({ type: "done" }).value).toEqual(
      put(narrativeActions.generateNarrativeSucceeded()),
    );
    expect(generator.next().done).toBe(true);
    expect(channel.close).toHaveBeenCalledOnce();
  });

  it("surfaces stream errors", () => {
    const channel = createFakeChannel();
    const request = buildNarrativeAgentRequest(pullRequest);
    const generator = generateNarrativeSaga();

    expect(generator.next().value).toEqual(select(selectPrData));
    expect(generator.next(pullRequest).value).toEqual(call(createNarrativeAgentChannel, request));
    expect(generator.next(channel).value).toEqual(take(channel));
    expect(generator.next({ error: "Auth failed", type: "error" }).value).toEqual(
      put(narrativeActions.generateNarrativeFailed("Auth failed")),
    );
    expect(generator.next().done).toBe(true);
    expect(channel.close).toHaveBeenCalledOnce();
  });

  it("surfaces channel creation errors", () => {
    const request = buildNarrativeAgentRequest(pullRequest);
    const generator = generateNarrativeSaga();

    expect(generator.next().value).toEqual(select(selectPrData));
    expect(generator.next(pullRequest).value).toEqual(call(createNarrativeAgentChannel, request));
    expect(generator.throw(new Error("Narrative agent API is unavailable.")).value).toEqual(
      put(narrativeActions.generateNarrativeFailed("Narrative agent API is unavailable.")),
    );
    expect(generator.next().done).toBe(true);
  });
});

const createFakeChannel = (): EventChannel<NarrativeAgentEvent> =>
  ({
    close: vi.fn(),
    flush: vi.fn(),
    take: vi.fn(),
  }) as unknown as EventChannel<NarrativeAgentEvent>;
