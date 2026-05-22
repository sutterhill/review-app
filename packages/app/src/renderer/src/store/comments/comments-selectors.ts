import type { RootState } from "../store";
import type {
  AgentReplyState,
  AgentReviewState,
  CommentAuthor,
  CommentsForReference,
  CommentThread,
} from "./comments-types";

const IDLE_REVIEW: AgentReviewState = { status: "idle" };
const IDLE_REPLY: AgentReplyState = { status: "idle" };

const EMPTY_THREADS: CommentThread[] = [];
const EMPTY_BUCKET: CommentsForReference = {
  github: EMPTY_THREADS,
  local: EMPTY_THREADS,
};

const bucketCache = new Map<string, (state: RootState) => CommentsForReference>();
const allCache = new Map<string, (state: RootState) => CommentThread[]>();
const fileCache = new Map<string, (state: RootState) => CommentThread[]>();
const lineCache = new Map<string, (state: RootState) => CommentThread[]>();
const threadByIdCache = new Map<string, (state: RootState) => CommentThread | null>();
const replyStateCache = new Map<string, (state: RootState) => AgentReplyState>();
const reviewStateCache = new Map<string, (state: RootState) => AgentReviewState>();

export const selectCommentsBucket = (
  prReference: string,
): ((state: RootState) => CommentsForReference) => {
  let selector = bucketCache.get(prReference);
  if (!selector) {
    selector = (state: RootState) => state.comments.byReference[prReference] ?? EMPTY_BUCKET;
    bucketCache.set(prReference, selector);
  }
  return selector;
};

export const selectAllThreadsForPr = (
  prReference: string,
): ((state: RootState) => CommentThread[]) => {
  let selector = allCache.get(prReference);
  if (!selector) {
    selector = (state: RootState) => {
      const bucket = state.comments.byReference[prReference];
      if (!bucket) return [];
      return [...bucket.local, ...bucket.github];
    };
    allCache.set(prReference, selector);
  }
  return selector;
};

export const selectThreadsForFile = (
  prReference: string,
  filePath: string,
): ((state: RootState) => CommentThread[]) => {
  const key = `${prReference}::${filePath}`;
  let selector = fileCache.get(key);
  if (!selector) {
    selector = (state: RootState) => {
      const bucket = state.comments.byReference[prReference];
      if (!bucket) return [];
      const all = [...bucket.local, ...bucket.github];
      return all.filter((thread) => thread.filePath === filePath);
    };
    fileCache.set(key, selector);
  }
  return selector;
};

export const selectThreadsForLine = (
  prReference: string,
  filePath: string,
  line: number,
): ((state: RootState) => CommentThread[]) => {
  const key = `${prReference}::${filePath}::${line}`;
  let selector = lineCache.get(key);
  if (!selector) {
    selector = (state: RootState) => {
      const bucket = state.comments.byReference[prReference];
      if (!bucket) return [];
      const all = [...bucket.local, ...bucket.github];
      return all.filter(
        (thread) =>
          thread.filePath === filePath &&
          line >= thread.lineRange[0] &&
          line <= thread.lineRange[1],
      );
    };
    lineCache.set(key, selector);
  }
  return selector;
};

export const selectCurrentCommentAuthor = (state: RootState): CommentAuthor | null =>
  state.comments.currentUser;

export const selectAgentReviewState = (
  prReference: string,
): ((state: RootState) => AgentReviewState) => {
  let selector = reviewStateCache.get(prReference);
  if (!selector) {
    selector = (state: RootState) => state.comments.reviewByReference[prReference] ?? IDLE_REVIEW;
    reviewStateCache.set(prReference, selector);
  }
  return selector;
};

const hasAgentCache = new Map<string, (state: RootState) => boolean>();

export const selectHasAgentThreads = (prReference: string): ((state: RootState) => boolean) => {
  let selector = hasAgentCache.get(prReference);
  if (!selector) {
    selector = (state: RootState) => {
      const bucket = state.comments.byReference[prReference];
      if (!bucket) return false;
      return bucket.local.some((thread) =>
        thread.comments.some((comment) => comment.author.kind === "agent"),
      );
    };
    hasAgentCache.set(prReference, selector);
  }
  return selector;
};

export const selectAgentReplyState = (
  threadId: string,
): ((state: RootState) => AgentReplyState) => {
  let selector = replyStateCache.get(threadId);
  if (!selector) {
    selector = (state: RootState) => state.comments.replyByThread[threadId] ?? IDLE_REPLY;
    replyStateCache.set(threadId, selector);
  }
  return selector;
};

export const selectThreadById = (
  prReference: string,
  threadId: string,
): ((state: RootState) => CommentThread | null) => {
  const key = `${prReference}::${threadId}`;
  let selector = threadByIdCache.get(key);
  if (!selector) {
    selector = (state: RootState) => {
      const bucket = state.comments.byReference[prReference];
      if (!bucket) return null;
      return (
        bucket.local.find((entry) => entry.id === threadId) ??
        bucket.github.find((entry) => entry.id === threadId) ??
        null
      );
    };
    threadByIdCache.set(key, selector);
  }
  return selector;
};
