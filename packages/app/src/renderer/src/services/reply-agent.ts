import type { Comment, CommentThread } from "../store/comments/comments-types";
import type { PullRequestData } from "../store/pr/pr-types";

export type ReplyAgentEvent =
  | { content: string; type: "chunk" }
  | { result: string; type: "done" }
  | { error: string; type: "error" };

export interface ReplyAgentController {
  abort: () => void;
}

export interface ReplyAgentComment {
  author: string;
  body: string;
  kind: "agent" | "user";
}

export interface ReplyAgentRequest {
  comments: ReplyAgentComment[];
  filePath: string;
  lineEnd: number;
  lineStart: number;
  patch?: string;
  pr: { reference: string; title: string };
}

const MAX_PATCH_CHARS = 4000;

export const startReplyAgentSession = (
  request: ReplyAgentRequest,
  onEvent: (event: ReplyAgentEvent) => void,
): ReplyAgentController => {
  if (typeof window === "undefined" || !window.reviewAppReplyAgent) {
    throw new Error("Reply agent API is unavailable.");
  }

  return window.reviewAppReplyAgent.run(request, onEvent);
};

export const buildReplyAgentRequest = (
  pullRequest: PullRequestData,
  thread: CommentThread,
): ReplyAgentRequest => {
  const file = pullRequest.files.find((entry) => entry.filename === thread.filePath);
  return {
    comments: thread.comments.map(toReplyAgentComment),
    filePath: thread.filePath,
    lineEnd: thread.lineRange[1],
    lineStart: thread.lineRange[0],
    patch: file ? truncatePatch(file.patch) : undefined,
    pr: {
      reference: pullRequest.metadata.reference,
      title: pullRequest.metadata.title,
    },
  };
};

const toReplyAgentComment = (comment: Comment): ReplyAgentComment => ({
  author: comment.author.login,
  body: comment.body,
  kind: comment.author.kind,
});

const truncatePatch = (patch: string): string => {
  if (patch.length <= MAX_PATCH_CHARS) return patch;
  return `${patch.slice(0, MAX_PATCH_CHARS)}\n...diff truncated for reply generation...`;
};
