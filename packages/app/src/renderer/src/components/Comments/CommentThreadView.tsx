import {
  ArrowPathIcon,
  ArrowUpIcon,
  ArrowTopRightOnSquareIcon,
  AtSymbolIcon,
  CheckIcon,
  EllipsisHorizontalIcon,
  PaperClipIcon,
  TrashIcon,
} from "@heroicons/react/16/solid";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { cn } from "@/lib/utils";

import { selectAgentReplyState } from "../../store/comments/comments-selectors";
import { commentsActions } from "../../store/comments/comments-slice";
import type { Comment, CommentCategory, CommentThread } from "../../store/comments/comments-types";
import type { AppDispatch } from "../../store/store";
import { CollapseChevron } from "../CollapseChevron";
import { buildLocalReply, DEFAULT_USER_AUTHOR, formatRelativeTime } from "./comment-helpers";
import { CommentAuthorAvatar } from "./CommentAuthorAvatar";
import { CommentCategoryIcon } from "./CommentCategoryIcon";
import { CommentMarkdown } from "./CommentMarkdown";

interface CommentThreadViewProps {
  className?: string;
  defaultCollapsed?: boolean;
  thread: CommentThread;
}

const ANIMATION_MS = 200;

type ThreadAnimationPhase = "enter" | "idle" | "exit";

export const CommentThreadView = ({
  className,
  defaultCollapsed = false,
  thread,
}: CommentThreadViewProps): React.JSX.Element => {
  const dispatch = useDispatch<AppDispatch>();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<ThreadAnimationPhase>("enter");
  const [animating, setAnimating] = useState(true);
  const exitTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLElement>(null);
  const isGithub = thread.source === "github";
  const replyState = useSelector(selectAgentReplyState(thread.id));
  const isAgentReplying = replyState.status === "running";

  const category = thread.category ?? thread.comments[0]?.category;
  const firstComment = thread.comments[0];

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent): void => {
      const inside = containerRef.current?.contains(event.target as Node) ?? false;
      setActive(inside);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  useEffect(() => {
    if (phase !== "enter") return;
    const frame = requestAnimationFrame(() => {
      setPhase("idle");
    });
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  useEffect(() => {
    setAnimating(true);
    const t = window.setTimeout(() => setAnimating(false), ANIMATION_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(
    () => () => {
      if (exitTimerRef.current != null) window.clearTimeout(exitTimerRef.current);
    },
    [],
  );

  const handleResolve = useCallback(() => {
    dispatch(
      commentsActions.setResolved({
        prReference: thread.prReference,
        resolved: !thread.resolved,
        threadId: thread.id,
      }),
    );
  }, [dispatch, thread.id, thread.prReference, thread.resolved]);

  const handleDelete = useCallback(() => {
    if (phase === "exit") return;
    setPhase("exit");
    exitTimerRef.current = window.setTimeout(() => {
      dispatch(
        commentsActions.removeLocalThread({
          prReference: thread.prReference,
          threadId: thread.id,
        }),
      );
    }, ANIMATION_MS);
  }, [dispatch, phase, thread.id, thread.prReference]);

  const handleReplySubmit = useCallback(
    (body: string) => {
      dispatch(
        commentsActions.addLocalReply({
          comment: buildLocalReply({
            author: DEFAULT_USER_AUTHOR,
            body,
            threadId: thread.id,
          }),
          prReference: thread.prReference,
          threadId: thread.id,
        }),
      );
      dispatch(
        commentsActions.requestAgentReply({
          prReference: thread.prReference,
          threadId: thread.id,
        }),
      );
    },
    [dispatch, thread.id, thread.prReference],
  );

  const effectiveCollapsed = collapsed && firstComment != null;
  const toggleCollapsed = useCallback((): void => {
    setCollapsed((prev) => !prev);
  }, []);

  const inner =
    effectiveCollapsed && firstComment ? (
      <section
        aria-label="Comment thread"
        className={cn("flex w-full min-w-0 font-sans", className)}
        data-comment-thread-id={thread.id}
        ref={containerRef}
      >
        <CollapsedHeaderPill
          category={category}
          firstComment={firstComment}
          isGithub={isGithub}
          onExpand={() => setCollapsed(false)}
          replyCount={thread.comments.length}
        />
      </section>
    ) : (
      <section
        aria-label="Comment thread"
        className={cn(
          "group/thread relative flex w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card font-sans text-card-foreground shadow-xs transition-shadow",
          active && "shadow-sm",
          className,
        )}
        data-comment-thread-id={thread.id}
        ref={containerRef}
      >
        <ExpandedHeaderBar
          category={category}
          isGithub={isGithub}
          onCollapse={toggleCollapsed}
          thread={thread}
        />
        <div className="min-h-0 overflow-hidden">
          <ol className="flex flex-col">
            {thread.comments.map((comment, index) => (
              <li key={comment.id}>
                <CommentItem
                  comment={comment}
                  hasConnector={index < thread.comments.length - 1}
                  isFirst={index === 0}
                  isResolved={thread.resolved}
                  onDelete={isGithub ? undefined : handleDelete}
                  onResolve={isGithub ? undefined : handleResolve}
                />
              </li>
            ))}
          </ol>
          {isAgentReplying ? (
            <p className="flex items-center gap-1.5 px-3 pb-2 text-[0.75rem] text-muted-foreground">
              <ArrowPathIcon className="size-3 animate-spin" />
              Agent is replying…
            </p>
          ) : replyState.status === "failed" && replyState.error ? (
            <p className="px-3 pb-2 text-[0.75rem] text-destructive">{replyState.error}</p>
          ) : null}
          {!isGithub && active ? (
            <ThreadReplyBar
              onCancel={() => setActive(false)}
              onSubmit={(body) => {
                handleReplySubmit(body);
                setActive(false);
              }}
            />
          ) : null}
        </div>
      </section>
    );

  const visible = phase === "idle";
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "grid transition-[grid-template-rows,opacity,transform] duration-200 ease-out motion-reduce:transition-none",
        visible
          ? "translate-y-0 scale-100 grid-rows-[1fr] opacity-100"
          : "-translate-y-1 scale-[0.98] grid-rows-[0fr] opacity-0",
      )}
    >
      <div className={cn("min-h-0", animating ? "overflow-hidden" : "overflow-visible")}>
        {inner}
      </div>
    </div>
  );
};

interface CollapsedHeaderPillProps {
  category: CommentCategory | undefined;
  firstComment: Comment;
  isGithub: boolean;
  onExpand: () => void;
  replyCount: number;
}

const CollapsedHeaderPill = ({
  category,
  firstComment,
  isGithub,
  onExpand,
  replyCount,
}: CollapsedHeaderPillProps): React.JSX.Element => {
  const labelClass = isGithub
    ? "bg-foreground text-background"
    : category
      ? CATEGORY_HEADER_CLASS[category]
      : "bg-muted text-muted-foreground";
  const label = isGithub ? "GitHub" : category ? CATEGORY_LABEL[category] : "Comment";

  return (
    <button
      aria-expanded={false}
      aria-label="Expand thread"
      className="group/pill flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md py-0.5 pr-2 text-left transition-opacity hover:opacity-90"
      onClick={onExpand}
      type="button"
    >
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider",
          labelClass,
        )}
      >
        <CommentCategoryIcon category={category} className="size-3 shrink-0" isGithub={isGithub} />
        <span>{label}</span>
        {replyCount > 1 ? <span className="opacity-70">· {replyCount}</span> : null}
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.8rem] text-muted-foreground">
        {firstLine(firstComment.body)}
      </span>
      <CollapseChevron
        className="size-3.5 shrink-0 text-muted-foreground opacity-70 group-hover/pill:opacity-100"
        collapsed
      />
    </button>
  );
};

const firstLine = (body: string): string => {
  const trimmed = body.trim();
  const newlineIndex = trimmed.indexOf("\n");
  return newlineIndex === -1 ? trimmed : trimmed.slice(0, newlineIndex);
};

interface ExpandedHeaderBarProps {
  category: CommentCategory | undefined;
  isGithub: boolean;
  onCollapse: () => void;
  thread: CommentThread;
}

const ExpandedHeaderBar = ({
  category,
  isGithub,
  onCollapse,
  thread,
}: ExpandedHeaderBarProps): React.JSX.Element => {
  const barClass = isGithub
    ? "bg-foreground text-background"
    : category
      ? CATEGORY_HEADER_CLASS[category]
      : "bg-muted text-muted-foreground";

  return (
    <div className={cn("relative flex items-center", barClass)}>
      <button
        aria-expanded
        aria-label="Collapse thread"
        className="flex flex-1 cursor-pointer items-center gap-2 px-3 py-1.5 text-left"
        onClick={onCollapse}
        type="button"
      >
        <CommentCategoryIcon
          category={category}
          className="size-3.5 shrink-0"
          isGithub={isGithub}
        />
        <span className="text-[0.65rem] font-semibold uppercase tracking-wider">
          {isGithub ? "GitHub review comment" : category ? CATEGORY_LABEL[category] : "Comment"}
        </span>
        <CollapseChevron className="ml-auto size-3.5 shrink-0 opacity-70" collapsed={false} />
      </button>
      {isGithub && thread.githubUrl ? (
        <a
          aria-label="View on GitHub"
          className="mr-2 inline-flex items-center text-background/80 hover:text-background"
          href={thread.githubUrl}
          onClick={(event) => event.stopPropagation()}
          rel="noreferrer"
          target="_blank"
          title="View on GitHub"
        >
          <ArrowTopRightOnSquareIcon className="size-3.5" />
        </a>
      ) : null}
    </div>
  );
};

interface CommentItemProps {
  comment: Comment;
  hasConnector: boolean;
  isFirst: boolean;
  isResolved: boolean;
  onDelete?: () => void;
  onResolve?: () => void;
}

const CommentItem = ({
  comment,
  hasConnector,
  isFirst,
  isResolved,
  onDelete,
  onResolve,
}: CommentItemProps): React.JSX.Element => (
  <article className={cn("group/comment relative flex gap-2.5 px-3", isFirst ? "pt-2.5" : "pt-1")}>
    <div className="relative flex flex-col items-center">
      <CommentAuthorAvatar author={comment.author} />
      {hasConnector ? <span aria-hidden="true" className="mt-1 w-px flex-1 bg-border" /> : null}
    </div>
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-2.5">
      <header className="flex items-baseline gap-1.5 text-[0.75rem]">
        <span className="font-semibold text-foreground">{comment.author.login}</span>
        <span className="text-muted-foreground">{formatRelativeTime(comment.createdAt)}</span>
        {comment.githubUrl ? (
          <a
            className="text-muted-foreground hover:text-foreground"
            href={comment.githubUrl}
            rel="noreferrer"
            target="_blank"
            title="View on GitHub"
          >
            <ArrowTopRightOnSquareIcon className="size-3" />
          </a>
        ) : null}
      </header>
      <CommentMarkdown body={comment.body} />
    </div>
    <CommentActionBar isResolved={isResolved} onDelete={onDelete} onResolve={onResolve} />
  </article>
);

interface CommentActionBarProps {
  isResolved: boolean;
  onDelete?: () => void;
  onResolve?: () => void;
}

const CommentActionBar = ({
  isResolved,
  onDelete,
  onResolve,
}: CommentActionBarProps): React.JSX.Element => (
  <div
    aria-label="Comment actions"
    className="pointer-events-none absolute top-1 right-2 z-10 flex items-center gap-0.5 rounded-md border border-border/60 bg-popover p-0.5 opacity-0 shadow-sm transition-opacity group-hover/comment:pointer-events-auto group-hover/comment:opacity-100"
  >
    {onResolve ? (
      <ActionIconButton
        aria-label={isResolved ? "Reopen thread" : "Resolve thread"}
        onClick={onResolve}
      >
        <CheckIcon
          className={cn("size-3.5", isResolved && "text-emerald-600 dark:text-emerald-400")}
        />
      </ActionIconButton>
    ) : null}
    {onDelete ? (
      <ActionIconButton aria-label="Delete thread" onClick={onDelete} title="Delete thread">
        <TrashIcon className="size-3.5" />
      </ActionIconButton>
    ) : null}
    <ActionIconButton aria-label="More actions" disabled>
      <EllipsisHorizontalIcon className="size-3.5" />
    </ActionIconButton>
  </div>
);

interface ActionIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const ActionIconButton = ({
  children,
  className,
  ...rest
}: ActionIconButtonProps): React.JSX.Element => (
  <button
    className={cn(
      "inline-flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
      className,
    )}
    type="button"
    {...rest}
  >
    {children}
  </button>
);

interface ThreadReplyBarProps {
  onCancel: () => void;
  onSubmit: (body: string) => void;
}

const ThreadReplyBar = ({ onCancel, onSubmit }: ThreadReplyBarProps): React.JSX.Element => {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  }, [onSubmit, value]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSubmit();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    },
    [handleSubmit, onCancel],
  );

  const isEmpty = value.trim().length === 0;

  return (
    <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2">
      <CommentAuthorAvatar author={DEFAULT_USER_AUTHOR} />
      <textarea
        className="flex-1 resize-none self-center border-0 bg-transparent text-[0.85rem] leading-6 text-foreground outline-none placeholder:text-muted-foreground"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Reply…"
        ref={textareaRef}
        rows={1}
        value={value}
      />
      <div className="flex shrink-0 items-center gap-0.5">
        <ActionIconButton aria-label="Attach" disabled>
          <PaperClipIcon className="size-3.5" />
        </ActionIconButton>
        <ActionIconButton aria-label="Mention" disabled>
          <AtSymbolIcon className="size-3.5" />
        </ActionIconButton>
        <button
          aria-label="Send reply"
          className={cn(
            "inline-flex size-6 cursor-pointer items-center justify-center rounded-full bg-foreground text-background transition-opacity",
            isEmpty && "cursor-not-allowed opacity-30",
          )}
          disabled={isEmpty}
          onClick={handleSubmit}
          type="button"
        >
          <ArrowUpIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
};

const CATEGORY_LABEL: Record<CommentCategory, string> = {
  blocker: "Blocker",
  comment: "Comment",
  concern: "Concern",
  nit: "Nit",
  praise: "Praise",
  warning: "Warning",
};

const CATEGORY_HEADER_CLASS: Record<CommentCategory, string> = {
  blocker: "bg-destructive/15 text-destructive",
  comment: "bg-muted text-muted-foreground",
  concern: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  nit: "bg-muted text-muted-foreground",
  praise: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
};
