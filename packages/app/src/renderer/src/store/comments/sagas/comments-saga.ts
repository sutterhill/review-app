import type { PayloadAction } from "@reduxjs/toolkit";
import { eventChannel, type EventChannel } from "redux-saga";
import { all, call, debounce, put, select, take, takeEvery } from "redux-saga/effects";

import { extractStreamingLine } from "../../../lib/streaming-line";
import { fetchPullRequestReviewComments } from "../../../services/github";
import {
  buildReplyAgentRequest,
  startReplyAgentSession,
  type ReplyAgentEvent,
} from "../../../services/reply-agent";
import {
  buildReviewAgentRequest,
  startReviewAgentSession,
  type ReviewAgentEvent,
} from "../../../services/review-agent";
import { selectPrData } from "../../pr/pr-selectors";
import { prActions } from "../../pr/pr-slice";
import type { PullRequestData } from "../../pr/pr-types";
import { buildAgentReply, buildAgentThread } from "../comment-builder";
import { selectCommentsBucket, selectThreadById } from "../comments-selectors";
import { commentsActions } from "../comments-slice";
import type { CommentCategory, CommentsForReference, CommentThread } from "../comments-types";

export const loadLocalThreadsFromDisk = async (prReference: string): Promise<CommentThread[]> => {
  if (typeof window === "undefined" || !window.reviewAppComments) {
    return [];
  }
  const raw = await window.reviewAppComments.load(prReference);
  return raw.filter(isCommentThread);
};

export const saveLocalThreadsToDisk = async (
  prReference: string,
  threads: CommentThread[],
): Promise<void> => {
  if (typeof window === "undefined" || !window.reviewAppComments) {
    return;
  }
  await window.reviewAppComments.save(prReference, threads);
};

export function* loadCommentsSaga(action: PayloadAction<{ prReference: string }>): Generator {
  const { prReference } = action.payload;
  const local = (yield call(loadLocalThreadsFromDisk, prReference)) as CommentThread[];
  yield put(commentsActions.hydrateLocalThreads({ prReference, threads: local }));

  try {
    const github = (yield call(fetchPullRequestReviewComments, prReference)) as CommentThread[];
    yield put(commentsActions.hydrateGithubThreads({ prReference, threads: github }));
  } catch {
    yield put(commentsActions.hydrateGithubThreads({ prReference, threads: [] }));
  }
}

export function* persistLocalThreadsSaga(
  action: PayloadAction<{ prReference: string } & Record<string, unknown>>,
): Generator {
  const bucket = (yield select(
    selectCommentsBucket(action.payload.prReference),
  )) as CommentsForReference;
  yield call(saveLocalThreadsToDisk, action.payload.prReference, bucket.local);
}

export function* loadCommentsForPrSaga(action: PayloadAction<string>): Generator {
  yield put(commentsActions.loadComments({ prReference: action.payload }));
}

export function createReviewAgentChannel(request: ReturnType<typeof buildReviewAgentRequest>) {
  return eventChannel<ReviewAgentEvent>((emit) => {
    const controller = startReviewAgentSession(request, (event) => {
      emit(event);
    });
    return () => controller.abort();
  });
}

export function* runAgentReviewSaga(action: PayloadAction<{ prReference: string }>): Generator {
  const { prReference } = action.payload;
  const prData = (yield select(selectPrData)) as PullRequestData | null;
  if (!prData || prData.metadata.reference !== prReference) {
    yield put(commentsActions.reviewFailed({ error: "No pull request loaded.", prReference }));
    return;
  }

  yield put(commentsActions.reviewStarted({ prReference }));

  const request = buildReviewAgentRequest(prData);
  const channel = (yield call(createReviewAgentChannel, request)) as EventChannel<ReviewAgentEvent>;

  let buffer = "";
  try {
    while (true) {
      const event = (yield take(channel)) as ReviewAgentEvent;
      if (event.type === "chunk") {
        buffer += event.content;
        yield put(
          commentsActions.reviewChunk({ prReference, preview: extractStreamingLine(buffer) }),
        );
        continue;
      }
      if (event.type === "error") {
        yield put(commentsActions.reviewFailed({ error: event.error, prReference }));
        channel.close();
        return;
      }
      if (event.type === "done") {
        const text = event.result || buffer;
        const threads = parseReviewResponse(text, prReference);
        yield put(commentsActions.replaceAgentThreads({ prReference, threads }));
        yield put(commentsActions.reviewSucceeded({ prReference }));
        channel.close();
        return;
      }
    }
  } catch (error) {
    yield put(
      commentsActions.reviewFailed({
        error: error instanceof Error ? error.message : "Review agent session failed.",
        prReference,
      }),
    );
    channel.close();
  }
}

export function* persistAgentThreadsSaga(
  action: PayloadAction<{ prReference: string }>,
): Generator {
  const bucket = (yield select(
    selectCommentsBucket(action.payload.prReference),
  )) as CommentsForReference;
  yield call(saveLocalThreadsToDisk, action.payload.prReference, bucket.local);
}

export function createReplyAgentChannel(request: ReturnType<typeof buildReplyAgentRequest>) {
  return eventChannel<ReplyAgentEvent>((emit) => {
    const controller = startReplyAgentSession(request, (event) => {
      emit(event);
    });
    return () => controller.abort();
  });
}

export function* runAgentReplySaga(
  action: PayloadAction<{ prReference: string; threadId: string }>,
): Generator {
  const { prReference, threadId } = action.payload;
  const prData = (yield select(selectPrData)) as PullRequestData | null;
  if (!prData || prData.metadata.reference !== prReference) {
    yield put(commentsActions.agentReplyFailed({ error: "No pull request loaded.", threadId }));
    return;
  }
  const thread = (yield select(selectThreadById(prReference, threadId))) as CommentThread | null;
  if (!thread) {
    yield put(commentsActions.agentReplyFailed({ error: "Thread not found.", threadId }));
    return;
  }
  if (thread.source !== "local") {
    yield put(
      commentsActions.agentReplyFailed({ error: "Cannot reply to GitHub thread.", threadId }),
    );
    return;
  }

  yield put(commentsActions.agentReplyStarted({ threadId }));

  const request = buildReplyAgentRequest(prData, thread);
  const channel = (yield call(createReplyAgentChannel, request)) as EventChannel<ReplyAgentEvent>;

  let buffer = "";
  try {
    while (true) {
      const event = (yield take(channel)) as ReplyAgentEvent;
      if (event.type === "chunk") {
        buffer += event.content;
        continue;
      }
      if (event.type === "error") {
        yield put(commentsActions.agentReplyFailed({ error: event.error, threadId }));
        channel.close();
        return;
      }
      if (event.type === "done") {
        const text = (event.result || buffer).trim();
        if (text.length === 0) {
          yield put(
            commentsActions.agentReplyFailed({ error: "Agent returned no text.", threadId }),
          );
          channel.close();
          return;
        }
        yield put(
          commentsActions.addLocalReply({
            comment: buildAgentReply({ body: text, threadId }),
            prReference,
            threadId,
          }),
        );
        yield put(commentsActions.agentReplySucceeded({ threadId }));
        channel.close();
        return;
      }
    }
  } catch (error) {
    yield put(
      commentsActions.agentReplyFailed({
        error: error instanceof Error ? error.message : "Reply agent session failed.",
        threadId,
      }),
    );
    channel.close();
  }
}

export function* commentsSaga(): Generator {
  yield all([
    takeEvery(commentsActions.loadComments.type, loadCommentsSaga),
    takeEvery(prActions.fetchPr.type, loadCommentsForPrSaga),
    takeEvery(commentsActions.requestAgentReview.type, runAgentReviewSaga),
    takeEvery(commentsActions.requestAgentReply.type, runAgentReplySaga),
    debounce(150, commentsActions.addLocalThread.type, persistLocalThreadsSaga),
    debounce(150, commentsActions.addLocalReply.type, persistLocalThreadsSaga),
    debounce(150, commentsActions.removeLocalThread.type, persistLocalThreadsSaga),
    debounce(150, commentsActions.setResolved.type, persistLocalThreadsSaga),
    debounce(150, commentsActions.replaceAgentThreads.type, persistAgentThreadsSaga),
    debounce(150, commentsActions.clearAgentThreads.type, persistAgentThreadsSaga),
  ]);
}

const VALID_CATEGORIES: ReadonlySet<CommentCategory> = new Set<CommentCategory>([
  "blocker",
  "comment",
  "concern",
  "nit",
  "praise",
  "warning",
]);

interface RawReviewComment {
  body: unknown;
  category: unknown;
  filePath: unknown;
  lineEnd: unknown;
  lineStart: unknown;
}

const parseReviewResponse = (text: string, prReference: string): CommentThread[] => {
  const json = extractJsonObject(text);
  if (!json) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const raw = (parsed as { comments?: unknown }).comments;
  if (!Array.isArray(raw)) return [];

  const threads: CommentThread[] = [];
  for (const entry of raw as RawReviewComment[]) {
    if (!entry || typeof entry !== "object") continue;
    if (typeof entry.filePath !== "string" || entry.filePath.length === 0) continue;
    if (typeof entry.body !== "string" || entry.body.trim().length === 0) continue;
    if (typeof entry.lineStart !== "number" || !Number.isFinite(entry.lineStart)) continue;
    const lineEnd =
      typeof entry.lineEnd === "number" && Number.isFinite(entry.lineEnd)
        ? entry.lineEnd
        : entry.lineStart;
    const category =
      typeof entry.category === "string" && VALID_CATEGORIES.has(entry.category as CommentCategory)
        ? (entry.category as CommentCategory)
        : "comment";
    const start = Math.max(1, Math.floor(entry.lineStart));
    const end = Math.max(start, Math.floor(lineEnd));
    threads.push(
      buildAgentThread({
        body: entry.body.trim(),
        category,
        filePath: entry.filePath,
        lineRange: [start, end],
        prReference,
      }),
    );
  }
  return threads;
};

const extractJsonObject = (text: string): string | null => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
};

const isCommentAuthor = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  const author = value as Record<string, unknown>;
  return (
    (author.kind === "agent" || author.kind === "user") &&
    typeof author.login === "string" &&
    (author.avatarUrl === null || typeof author.avatarUrl === "string")
  );
};

const isComment = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  const comment = value as Record<string, unknown>;
  return (
    typeof comment.id === "string" &&
    typeof comment.body === "string" &&
    typeof comment.createdAt === "string" &&
    typeof comment.threadId === "string" &&
    (comment.source === "github" || comment.source === "local") &&
    isCommentAuthor(comment.author)
  );
};

const isCommentThread = (value: unknown): value is CommentThread => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CommentThread>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.filePath === "string" &&
    typeof candidate.prReference === "string" &&
    Array.isArray(candidate.lineRange) &&
    candidate.lineRange.length === 2 &&
    typeof candidate.lineRange[0] === "number" &&
    typeof candidate.lineRange[1] === "number" &&
    Array.isArray(candidate.comments) &&
    candidate.comments.every(isComment)
  );
};
