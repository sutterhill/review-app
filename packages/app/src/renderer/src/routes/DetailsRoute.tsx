import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router";

import { Markdown } from "@/components/Markdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { CommentThreadView } from "../components/Comments/CommentThreadView";
import { selectAllThreadsForPr } from "../store/comments/comments-selectors";
import type { CommentThread } from "../store/comments/comments-types";

type CodeThreadFilter = "agent" | "all" | "user";

const FILTERS: { label: string; value: CodeThreadFilter }[] = [
  { label: "All", value: "all" },
  { label: "Review", value: "agent" },
  { label: "User", value: "user" },
];

const isAgentThread = (thread: CommentThread): boolean =>
  thread.comments.some((comment) => comment.author.kind === "agent");
import {
  selectPrComments,
  selectPrCommentsError,
  selectPrCommentsStatus,
} from "../store/pr/pr-selectors";
import { usePRContext } from "./pr-context";

export const DetailsRoute = (): React.JSX.Element => {
  const { prData, setSidebar } = usePRContext();
  const navigate = useNavigate();
  const comments = useSelector(selectPrComments);
  const commentsError = useSelector(selectPrCommentsError);
  const commentsStatus = useSelector(selectPrCommentsStatus);
  const codeThreads = useSelector(selectAllThreadsForPr(prData.metadata.reference));
  const [threadFilter, setThreadFilter] = useState<CodeThreadFilter>("all");
  const filteredCodeThreads = useMemo(() => {
    if (threadFilter === "all") return codeThreads;
    if (threadFilter === "agent") return codeThreads.filter(isAgentThread);
    return codeThreads.filter((thread) => !isAgentThread(thread));
  }, [codeThreads, threadFilter]);
  const codeThreadsByFile = useMemo(
    () => groupThreadsByFile(filteredCodeThreads),
    [filteredCodeThreads],
  );
  const hasDescription = prData.metadata.body.trim().length > 0;

  useEffect(() => {
    setSidebar(
      <div className="flex flex-col gap-4 p-3">
        <h2 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pull Request
        </h2>
        <div className="flex flex-col gap-3 px-2">
          <div>
            <p className="text-xs text-muted-foreground">Author</p>
            <p className="text-sm">{prData.metadata.author.login}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="text-sm capitalize">{prData.metadata.state}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="text-sm">{formatCommentDate(prData.metadata.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Updated</p>
            <p className="text-sm">{formatCommentDate(prData.metadata.updatedAt)}</p>
          </div>
          {prData.metadata.labels.length > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground">Labels</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {prData.metadata.labels.map((label) => (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs" key={label}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {prData.metadata.reviewers.length > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground">Reviewers</p>
              <div className="mt-1 flex flex-col gap-1">
                {prData.metadata.reviewers.map((reviewer) => (
                  <span className="text-sm" key={reviewer.login}>
                    {reviewer.login}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>,
    );
    return () => setSidebar(null);
  }, [prData, setSidebar]);

  return (
    <div className="flex flex-col gap-8 p-4">
      <section className="max-w-[70ch]">
        <h2 className="text-sm font-semibold text-foreground">Description</h2>
        {hasDescription ? (
          <Markdown className="mt-2 text-foreground/80" content={prData.metadata.body} />
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No description provided.</p>
        )}
      </section>

      <section className="max-w-[70ch]">
        <h2 className="text-sm font-semibold text-foreground">
          Comments {comments.length > 0 ? `(${comments.length})` : ""}
        </h2>
        {commentsStatus === "loading" ? (
          <div className="mt-3 flex flex-col gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : commentsStatus === "failed" ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {commentsError?.message ?? "Unable to load comments."}
          </p>
        ) : comments.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {comments.map((comment) => (
              <div className="flex gap-3" key={comment.id}>
                <Avatar size="sm">
                  {comment.author.avatarUrl ? (
                    <AvatarImage alt={`@${comment.author.login}`} src={comment.author.avatarUrl} />
                  ) : null}
                  <AvatarFallback>{comment.author.login.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {comment.author.login}
                    </span>
                    <time className="text-xs text-muted-foreground">
                      {formatCommentDate(comment.createdAt)}
                    </time>
                  </div>
                  <Markdown className="mt-1 text-foreground/80" content={comment.body} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="max-w-[70ch]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            Code-anchored comments{" "}
            {codeThreads.length > 0 ? `(${filteredCodeThreads.length}/${codeThreads.length})` : ""}
          </h2>
          {codeThreads.length > 0 ? (
            <div
              aria-label="Filter code-anchored comments"
              className="inline-flex rounded-md border border-border p-0.5"
            >
              {FILTERS.map((option) => (
                <button
                  aria-pressed={threadFilter === option.value}
                  className={cn(
                    "cursor-pointer rounded-sm px-2 py-0.5 text-[0.7rem] text-muted-foreground hover:text-foreground",
                    threadFilter === option.value && "bg-muted text-foreground",
                  )}
                  key={option.value}
                  onClick={() => setThreadFilter(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {codeThreads.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No comments anchored to code yet.</p>
        ) : filteredCodeThreads.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No comments match the current filter.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {Array.from(codeThreadsByFile.entries()).map(([filePath, threads]) => (
              <div className="flex flex-col gap-2" key={filePath}>
                <button
                  className="flex w-fit cursor-pointer items-baseline gap-1.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => navigate(`../diff?file=${encodeURIComponent(filePath)}`)}
                  type="button"
                >
                  <span className="font-mono">{filePath}</span>
                  <span className="text-[0.7rem]">({threads.length})</span>
                </button>
                {threads.map((thread) => (
                  <div className="flex flex-col gap-1" key={thread.id}>
                    <span className="text-[0.7rem] text-muted-foreground">
                      Lines {thread.lineRange[0]}
                      {thread.lineRange[1] !== thread.lineRange[0] ? `–${thread.lineRange[1]}` : ""}
                    </span>
                    <CommentThreadView thread={thread} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const groupThreadsByFile = (threads: readonly CommentThread[]): Map<string, CommentThread[]> => {
  const map = new Map<string, CommentThread[]>();
  for (const thread of threads) {
    const list = map.get(thread.filePath) ?? [];
    list.push(thread);
    map.set(thread.filePath, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.lineRange[0] - b.lineRange[0]);
  }
  return map;
};

const formatCommentDate = (createdAt: string): string => {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
};
