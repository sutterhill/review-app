import type { LineRange } from "../walkthrough/walkthrough-types";
import type {
  Comment,
  CommentAuthor,
  CommentCategory,
  CommentSide,
  CommentThread,
} from "./comments-types";

let counter = 0;

const nextId = (prefix: string): string => {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
};

export const DEFAULT_AGENT_AUTHOR: CommentAuthor = {
  avatarUrl: null,
  kind: "agent",
  login: "agent",
};

export const buildLocalThread = (input: {
  author: CommentAuthor;
  body: string;
  filePath: string;
  lineRange: LineRange;
  prReference: string;
  side?: CommentSide;
}): CommentThread => {
  const threadId = nextId("thread");
  const createdAt = new Date().toISOString();
  return {
    comments: [
      {
        author: input.author,
        body: input.body,
        createdAt,
        id: nextId("comment"),
        source: "local",
        threadId,
      },
    ],
    filePath: input.filePath,
    id: threadId,
    lineRange: input.lineRange,
    prReference: input.prReference,
    resolved: false,
    side: input.side ?? "new",
    source: "local",
  };
};

export const buildAgentThread = (input: {
  body: string;
  category: CommentCategory;
  filePath: string;
  lineRange: LineRange;
  prReference: string;
  side?: CommentSide;
}): CommentThread => {
  const threadId = nextId("agent-thread");
  const createdAt = new Date().toISOString();
  return {
    category: input.category,
    comments: [
      {
        author: DEFAULT_AGENT_AUTHOR,
        body: input.body,
        category: input.category,
        createdAt,
        id: nextId("agent-comment"),
        source: "local",
        threadId,
      },
    ],
    filePath: input.filePath,
    id: threadId,
    lineRange: input.lineRange,
    prReference: input.prReference,
    resolved: false,
    side: input.side ?? "new",
    source: "local",
  };
};

export const buildLocalReply = (input: {
  author: CommentAuthor;
  body: string;
  threadId: string;
}): Comment => ({
  author: input.author,
  body: input.body,
  createdAt: new Date().toISOString(),
  id: nextId("comment"),
  source: "local",
  threadId: input.threadId,
});

export const buildAgentReply = (input: { body: string; threadId: string }): Comment => ({
  author: DEFAULT_AGENT_AUTHOR,
  body: input.body,
  createdAt: new Date().toISOString(),
  id: nextId("agent-comment"),
  source: "local",
  threadId: input.threadId,
});
