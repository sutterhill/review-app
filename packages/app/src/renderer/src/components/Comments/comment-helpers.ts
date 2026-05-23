import type { CommentAuthor, CommentThread } from "../../store/comments/comments-types";

export {
  buildAgentThread,
  buildLocalReply,
  buildLocalThread,
  DEFAULT_AGENT_AUTHOR,
} from "../../store/comments/comment-builder";

export const formatThreadContextForClipboard = (thread: CommentThread): string => {
  const [startLine, endLine] = thread.lineRange;
  const lineLabel = startLine === endLine ? `line ${startLine}` : `lines ${startLine}-${endLine}`;
  const header = [
    `PR: ${thread.prReference}`,
    `File: ${thread.filePath} (${lineLabel})`,
    `Side: ${thread.side === "old" ? "old (before)" : "new (after)"}`,
  ];
  if (thread.githubUrl) header.push(`URL: ${thread.githubUrl}`);

  const body = thread.comments.map((comment) => {
    const label = `@${comment.author.login}${comment.author.kind === "agent" ? " (agent)" : ""}`;
    return `${label}:\n${comment.body.trim()}`;
  });

  return [...header, "", "Comment thread:", "", body.join("\n\n")].join("\n");
};

export const formatRelativeTime = (iso: string, now: number = Date.now()): string => {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  const diffMs = now - time;
  if (diffMs < 60_000) return "just now";
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(time).toLocaleDateString();
};

export const DEFAULT_USER_AUTHOR: CommentAuthor = {
  avatarUrl: null,
  kind: "user",
  login: "you",
};
