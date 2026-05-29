import { PauseIcon, PlayIcon } from "@heroicons/react/16/solid";
import { useDispatch } from "react-redux";
import { Link } from "react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { runWithViewTransition, sanitizeViewTransitionName } from "@/lib/view-transition";

import { asideActions } from "../../store/aside/aside-slice";
import type { PullRequestSummary } from "../../store/pr/pr-types";
import type { AppDispatch } from "../../store/store";
import { RelativeTime } from "../RelativeTime";

type PrStateId = "approved" | "changes_requested" | "draft" | "open" | "review_required";

interface PrState {
  iconClass: string;
  id: PrStateId;
  label: string;
}

export const getPullRequestState = (pullRequest: PullRequestSummary): PrState => {
  if (pullRequest.isDraft) {
    return { iconClass: "text-muted-foreground", id: "draft", label: "Draft" };
  }

  if (pullRequest.reviewDecision === "changes_requested") {
    return { iconClass: "text-destructive", id: "changes_requested", label: "Changes requested" };
  }

  if (pullRequest.reviewDecision === "approved") {
    return { iconClass: "text-emerald-600", id: "approved", label: "Approved" };
  }

  if (pullRequest.reviewDecision === "review_required") {
    return { iconClass: "text-amber-600", id: "review_required", label: "Review required" };
  }

  return { iconClass: "text-emerald-600", id: "open", label: "Open" };
};

const PullRequestIcon = ({ className }: { className?: string }): React.JSX.Element => (
  <svg
    aria-hidden
    className={cn("h-3.5 w-3.5 shrink-0", className)}
    fill="currentColor"
    viewBox="0 0 16 16"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
  </svg>
);

export const ASIDE_DRAG_TYPE = "application/x-review-app-aside-pr";

export type AsideCardAction = "set" | "remove";

export const resolveAsideAction = (asideAction: AsideCardAction, reference: string) =>
  asideAction === "set" ? asideActions.setAside(reference) : asideActions.removeAside(reference);

export const dispatchAsideToggle = (
  dispatch: AppDispatch,
  asideAction: AsideCardAction,
  reference: string,
): void => {
  dispatch(resolveAsideAction(asideAction, reference));
};

interface PRListItemProps {
  asideAction?: AsideCardAction;
  pullRequest: PullRequestSummary;
  slotId?: string;
}

export const PRListItem = ({
  asideAction,
  pullRequest,
  slotId,
}: PRListItemProps): React.JSX.Element => {
  const dispatch = useDispatch<AppDispatch>();
  const reviewPath = `/pr/${pullRequest.owner}/${pullRequest.repo}/${pullRequest.number}`;
  const isDraggable = asideAction != null;

  const handleDragStart = (event: React.DragEvent<HTMLElement>) => {
    event.dataTransfer.setData(ASIDE_DRAG_TYPE, pullRequest.reference);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleAsideClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (asideAction) {
      runWithViewTransition(() => {
        dispatchAsideToggle(dispatch, asideAction, pullRequest.reference);
      });
    }
  };

  const state = getPullRequestState(pullRequest);

  const AsideIcon = asideAction === "set" ? PauseIcon : PlayIcon;

  const transitionKey = slotId ? `${slotId}-${pullRequest.reference}` : pullRequest.reference;

  return (
    <article
      className="pr-card group relative"
      draggable={isDraggable}
      onDragStart={isDraggable ? handleDragStart : undefined}
      style={{ viewTransitionName: sanitizeViewTransitionName(transitionKey) }}
    >
      <Link
        className={cn(
          "flex flex-col gap-1.5 py-2 text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        draggable={false}
        to={reviewPath}
      >
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm leading-snug">{pullRequest.title}</h3>
          <Avatar
            className={cn(
              "!size-5 transition-opacity duration-150",
              asideAction ? "group-hover:opacity-0 group-focus-within:opacity-0" : null,
            )}
            size="sm"
          >
            {pullRequest.author.avatarUrl ? (
              <AvatarImage
                alt={`@${pullRequest.author.login}`}
                src={pullRequest.author.avatarUrl}
              />
            ) : null}
            <AvatarFallback>{getAvatarFallback(pullRequest.author.login)}</AvatarFallback>
          </Avatar>
        </div>
        <div className="flex min-w-0 flex-nowrap items-center gap-1 text-xs text-muted-foreground">
          <PullRequestIcon className={cn("shrink-0", state.iconClass)} />
          <div className="max-w-0 overflow-hidden transition-[max-width] duration-150 group-hover:max-w-[12rem] group-focus-within:max-w-[12rem]">
            <span className="block whitespace-nowrap pr-1.5">{state.label}</span>
          </div>
          <span className="shrink-0">#{pullRequest.number}</span>
          <RelativeTime className="ml-auto shrink-0" date={pullRequest.updatedAt} />
        </div>
      </Link>
      {asideAction ? (
        <Button
          aria-label={asideAction === "set" ? "Set aside" : "Restore"}
          className="absolute right-0 top-1.5 cursor-pointer opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
          onClick={handleAsideClick}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <AsideIcon aria-hidden className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </article>
  );
};

const getAvatarFallback = (login: string): string => login.slice(0, 2).toUpperCase() || "?";
