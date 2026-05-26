import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { Comment, CommentAuthor, CommentsState, CommentThread } from "./comments-types";

const initialState: CommentsState = {
  byReference: {},
  currentUser: null,
  replyByThread: {},
  reviewByReference: {},
};

const emptyForReference = (): { github: CommentThread[]; local: CommentThread[] } => ({
  github: [],
  local: [],
});

const ensureBucket = (state: CommentsState, prReference: string): void => {
  if (!state.byReference[prReference]) {
    state.byReference[prReference] = emptyForReference();
  }
};

export const commentsSlice = createSlice({
  initialState,
  name: "comments",
  reducers: {
    addLocalReply(
      state,
      action: PayloadAction<{ comment: Comment; prReference: string; threadId: string }>,
    ) {
      const bucket = state.byReference[action.payload.prReference];
      if (!bucket) return;
      const thread = bucket.local.find((entry) => entry.id === action.payload.threadId);
      if (!thread) return;
      if (thread.comments.some((entry) => entry.id === action.payload.comment.id)) return;
      thread.comments.push(action.payload.comment);
    },
    addLocalThread(state, action: PayloadAction<{ prReference: string; thread: CommentThread }>) {
      ensureBucket(state, action.payload.prReference);
      const bucket = state.byReference[action.payload.prReference]!;
      if (bucket.local.some((entry) => entry.id === action.payload.thread.id)) return;
      bucket.local.push(action.payload.thread);
    },
    hydrateGithubThreads(
      state,
      action: PayloadAction<{ prReference: string; threads: CommentThread[] }>,
    ) {
      ensureBucket(state, action.payload.prReference);
      state.byReference[action.payload.prReference]!.github = action.payload.threads;
    },
    hydrateLocalThreads(
      state,
      action: PayloadAction<{ prReference: string; threads: CommentThread[] }>,
    ) {
      ensureBucket(state, action.payload.prReference);
      state.byReference[action.payload.prReference]!.local = action.payload.threads;
    },
    loadComments(_state, _action: PayloadAction<{ prReference: string }>) {},
    removeLocalThread(state, action: PayloadAction<{ prReference: string; threadId: string }>) {
      const bucket = state.byReference[action.payload.prReference];
      if (!bucket) return;
      bucket.local = bucket.local.filter((entry) => entry.id !== action.payload.threadId);
    },
    replaceAgentThreads(
      state,
      action: PayloadAction<{ prReference: string; threads: CommentThread[] }>,
    ) {
      ensureBucket(state, action.payload.prReference);
      const bucket = state.byReference[action.payload.prReference]!;
      bucket.local = bucket.local.filter((entry) =>
        entry.comments.every((comment) => comment.author.kind !== "agent"),
      );
      bucket.local.push(...action.payload.threads);
    },
    clearAgentThreads(state, action: PayloadAction<{ prReference: string }>) {
      const bucket = state.byReference[action.payload.prReference];
      if (!bucket) return;
      bucket.local = bucket.local.filter((entry) =>
        entry.comments.every((comment) => comment.author.kind !== "agent"),
      );
      delete state.reviewByReference[action.payload.prReference];
    },
    requestAgentReview(_state, _action: PayloadAction<{ prReference: string }>) {},
    requestAgentReply(_state, _action: PayloadAction<{ prReference: string; threadId: string }>) {},
    agentReplyStarted(state, action: PayloadAction<{ threadId: string }>) {
      state.replyByThread[action.payload.threadId] = { status: "running" };
    },
    agentReplySucceeded(state, action: PayloadAction<{ threadId: string }>) {
      state.replyByThread[action.payload.threadId] = { status: "idle" };
    },
    agentReplyFailed(state, action: PayloadAction<{ error: string; threadId: string }>) {
      state.replyByThread[action.payload.threadId] = {
        error: action.payload.error,
        status: "failed",
      };
    },
    reviewChunk(state, action: PayloadAction<{ prReference: string; preview: string }>) {
      const current = state.reviewByReference[action.payload.prReference];
      if (!current || current.status !== "running") return;
      current.preview = action.payload.preview;
    },
    reviewFailed(state, action: PayloadAction<{ error: string; prReference: string }>) {
      state.reviewByReference[action.payload.prReference] = {
        error: action.payload.error,
        status: "failed",
      };
    },
    reviewStarted(state, action: PayloadAction<{ prReference: string }>) {
      state.reviewByReference[action.payload.prReference] = { preview: "", status: "running" };
    },
    reviewSucceeded(state, action: PayloadAction<{ prReference: string }>) {
      state.reviewByReference[action.payload.prReference] = { status: "idle" };
    },
    setResolved(
      state,
      action: PayloadAction<{ prReference: string; resolved: boolean; threadId: string }>,
    ) {
      const bucket = state.byReference[action.payload.prReference];
      if (!bucket) return;
      const thread = bucket.local.find((entry) => entry.id === action.payload.threadId);
      if (!thread) return;
      thread.resolved = action.payload.resolved;
    },
    setCurrentUser(state, action: PayloadAction<{ author: CommentAuthor | null }>) {
      state.currentUser = action.payload.author;
    },
  },
});

export const commentsActions = commentsSlice.actions;
export const commentsReducer = commentsSlice.reducer;
