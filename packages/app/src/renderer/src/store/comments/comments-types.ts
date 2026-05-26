import type { LineRange } from "../walkthrough/walkthrough-types";

export type CommentSource = "github" | "local";
export type CommentAuthorKind = "agent" | "user";
export type CommentSide = "new" | "old";
export type CommentCategory = "blocker" | "comment" | "concern" | "nit" | "praise" | "warning";

export interface CommentAuthor {
  avatarUrl: null | string;
  kind: CommentAuthorKind;
  login: string;
  url?: string;
}

export interface Comment {
  author: CommentAuthor;
  body: string;
  category?: CommentCategory;
  createdAt: string;
  githubUrl?: string;
  id: string;
  source: CommentSource;
  threadId: string;
}

export interface CommentThread {
  category?: CommentCategory;
  comments: Comment[];
  filePath: string;
  githubUrl?: string;
  id: string;
  lineRange: LineRange;
  prReference: string;
  resolved: boolean;
  side: CommentSide;
  source: CommentSource;
}

export interface CommentsForReference {
  github: CommentThread[];
  local: CommentThread[];
}

export type AgentReviewStatus = "failed" | "idle" | "running";

export interface AgentReviewState {
  error?: string;
  preview?: string;
  status: AgentReviewStatus;
}

export type AgentReplyStatus = "failed" | "idle" | "running";

export interface AgentReplyState {
  error?: string;
  status: AgentReplyStatus;
}

export interface CommentsState {
  byReference: Record<string, CommentsForReference>;
  currentUser: CommentAuthor | null;
  replyByThread: Record<string, AgentReplyState>;
  reviewByReference: Record<string, AgentReviewState>;
}
