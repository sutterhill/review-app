import { Fragment, useState } from "react";
import { useDispatch } from "react-redux";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { runWithViewTransition } from "@/lib/view-transition";

import { asideActions } from "../../store/aside/aside-slice";
import type { PullRequestSummary } from "../../store/pr/pr-types";
import type { AppDispatch } from "../../store/store";
import { ASIDE_DRAG_TYPE, type AsideCardAction, PRListItem } from "../PRList/PRListItem";

export type ColumnDropBehavior = "setAside" | "removeAside";

export const resolveDropAction = (dropBehavior: ColumnDropBehavior, reference: string) =>
  dropBehavior === "setAside"
    ? asideActions.setAside(reference)
    : asideActions.removeAside(reference);

export const createColumnDropHandler =
  (dispatch: AppDispatch, dropBehavior?: ColumnDropBehavior) =>
  (event: { preventDefault: () => void; dataTransfer: Pick<DataTransfer, "getData"> }): void => {
    if (!dropBehavior) {
      return;
    }

    event.preventDefault();
    const reference = event.dataTransfer.getData(ASIDE_DRAG_TYPE);

    if (reference) {
      runWithViewTransition(() => {
        dispatch(resolveDropAction(dropBehavior, reference));
      });
    }
  };

// Action-needed sub-groups for the My PRs column. Each pull request is assigned to the
// first matching bucket (priority order below), and buckets render in a fixed display order.
//
// | Condition                                    | Bucket            |
// | -------------------------------------------- | ----------------- |
// | reviewDecision === "changes_requested"       | Changes requested |
// | isDraft                                      | Draft             |
// | reviewDecision === null                      | No reviewers      |
// | otherwise (reviewDecision "review_required") | Awaiting review   |
//
// Approved pull requests never reach My PRs (they are de-duped into Waiting), so the
// "approved" decision is intentionally unrepresented here.
export type ActionBucketId = "awaiting_review" | "changes_requested" | "draft" | "no_reviewers";

export const assignActionBucket = (pullRequest: PullRequestSummary): ActionBucketId => {
  if (pullRequest.reviewDecision === "changes_requested") {
    return "changes_requested";
  }

  if (pullRequest.isDraft) {
    return "draft";
  }

  if (pullRequest.reviewDecision === null) {
    return "no_reviewers";
  }

  return "awaiting_review";
};

const ACTION_BUCKET_ORDER: { id: ActionBucketId; label: string }[] = [
  { id: "changes_requested", label: "Changes requested" },
  { id: "no_reviewers", label: "No reviewers" },
  { id: "awaiting_review", label: "Awaiting review" },
  { id: "draft", label: "Draft" },
];

export interface ActionSubGroup {
  id: ActionBucketId;
  label: string;
  pullRequests: PullRequestSummary[];
}

export const groupByActionNeeded = (pullRequests: PullRequestSummary[]): ActionSubGroup[] => {
  const buckets = new Map<ActionBucketId, PullRequestSummary[]>();

  for (const pullRequest of pullRequests) {
    const id = assignActionBucket(pullRequest);
    const existing = buckets.get(id);

    if (existing) {
      existing.push(pullRequest);
    } else {
      buckets.set(id, [pullRequest]);
    }
  }

  return ACTION_BUCKET_ORDER.flatMap(({ id, label }) => {
    const lanePullRequests = buckets.get(id);

    return lanePullRequests && lanePullRequests.length > 0
      ? [{ id, label, pullRequests: lanePullRequests }]
      : [];
  });
};

interface ColumnSlotProps {
  asideAction?: AsideCardAction;
  dropBehavior?: ColumnDropBehavior;
  pullRequests: PullRequestSummary[];
  subGroupByAction?: boolean;
  title: string;
}

export const ColumnSlot = ({
  asideAction,
  dropBehavior,
  pullRequests,
  subGroupByAction,
  title,
}: ColumnSlotProps): React.JSX.Element => {
  const dispatch = useDispatch<AppDispatch>();
  const [isDropTarget, setIsDropTarget] = useState(false);

  const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
    if (!dropBehavior) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsDropTarget(true);
  };

  const handleDragLeave = () => {
    setIsDropTarget(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    createColumnDropHandler(dispatch, dropBehavior)(event);
    setIsDropTarget(false);
  };

  return (
    <div
      aria-label={`${title} column`}
      className={cn(
        "flex min-h-[5rem] min-w-0 flex-col gap-3 transition-colors",
        isDropTarget && dropBehavior ? "bg-primary/5 ring-2 ring-primary/40" : "",
      )}
      onDragLeave={dropBehavior ? handleDragLeave : undefined}
      onDragOver={dropBehavior ? handleDragOver : undefined}
      onDrop={dropBehavior ? handleDrop : undefined}
    >
      {subGroupByAction ? (
        groupByActionNeeded(pullRequests).map((group) => (
          <SubGroup
            asideAction={asideAction}
            key={group.id}
            label={group.label}
            pullRequests={group.pullRequests}
          />
        ))
      ) : pullRequests.length > 0 ? (
        <div className="flex flex-col gap-1">
          <SubGroupHeaderPlaceholder />
          {renderCards(pullRequests, asideAction)}
        </div>
      ) : null}
    </div>
  );
};

interface WaitingColumnSlotProps {
  readyToMerge: PullRequestSummary[];
  waitingOnAuthor: PullRequestSummary[];
}

export const WaitingColumnSlot = ({
  readyToMerge,
  waitingOnAuthor,
}: WaitingColumnSlotProps): React.JSX.Element => (
  <div aria-label="Waiting column" className="flex min-h-[5rem] min-w-0 flex-col gap-3">
    {readyToMerge.length > 0 ? (
      <SubGroup label="Ready to merge" pullRequests={readyToMerge} />
    ) : null}
    {waitingOnAuthor.length > 0 ? (
      <SubGroup label="Waiting on author" pullRequests={waitingOnAuthor} />
    ) : null}
  </div>
);

interface SubGroupProps {
  asideAction?: AsideCardAction;
  label: string;
  pullRequests: PullRequestSummary[];
}

const SUB_GROUP_HEADER_CLASS =
  "text-[10px] font-medium uppercase tracking-wide leading-4 text-muted-foreground";

const SubGroupHeaderPlaceholder = (): React.JSX.Element => (
  <h3 aria-hidden className={SUB_GROUP_HEADER_CLASS}>{"\u00A0"}</h3>
);

const SubGroup = ({ asideAction, label, pullRequests }: SubGroupProps): React.JSX.Element => (
  <div className="flex flex-col gap-1">
    <h3 className={SUB_GROUP_HEADER_CLASS}>{label}</h3>
    {renderCards(pullRequests, asideAction)}
  </div>
);

const renderCards = (
  pullRequests: PullRequestSummary[],
  asideAction?: AsideCardAction,
): React.JSX.Element[] =>
  pullRequests.map((pullRequest, index) => (
    <Fragment key={pullRequest.reference}>
      <PRListItem asideAction={asideAction} pullRequest={pullRequest} />
      {index < pullRequests.length - 1 ? <Separator /> : null}
    </Fragment>
  ));
