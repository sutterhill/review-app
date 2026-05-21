import { Fragment, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  selectOpenPullRequests,
  selectOpenPullRequestsError,
  selectOpenPullRequestsStatus,
} from "../../store/pr/pr-selectors";
import { prActions } from "../../store/pr/pr-slice";
import type { PullRequestSummary } from "../../store/pr/pr-types";
import { selectRepoEntries } from "../../store/repos/repos-selectors";
import { normalizeRepoKey, reposActions } from "../../store/repos/repos-slice";
import type { RepoRegistryEntry, RepoWorktreeEntry } from "../../store/repos/repos-types";
import type { AppDispatch } from "../../store/store";

export const PRList = (): React.JSX.Element => {
  const dispatch = useDispatch<AppDispatch>();
  const pullRequests = useSelector(selectOpenPullRequests);
  const status = useSelector(selectOpenPullRequestsStatus);
  const error = useSelector(selectOpenPullRequestsError);
  const repoEntries = useSelector(selectRepoEntries);
  const repoGroups = groupPullRequestsByRepository(pullRequests);

  useEffect(() => {
    dispatch(prActions.fetchOpenPullRequests());
  }, [dispatch]);

  const isLoading = status === "loading";

  return (
    <div className="mx-auto w-full max-w-7xl rounded-lg bg-muted/30 p-4">
      <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Reviews</h1>
        </div>
        <Button
          disabled={isLoading}
          onClick={() => dispatch(prActions.fetchOpenPullRequests())}
          size="sm"
          type="button"
          variant="outline"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </Button>
      </header>
      <div className="flex min-h-0 flex-col gap-4 pt-4">
        {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
        {isLoading && pullRequests.length === 0 ? <PRListSkeleton /> : null}
        {!isLoading && pullRequests.length === 0 && !error ? (
          <p className="text-sm text-muted-foreground">
            No open pull requests are requesting your review.
          </p>
        ) : null}
        {repoGroups.length > 0 ? (
          <ScrollArea className="h-[calc(100vh-14rem)] pr-3" aria-label="Open review requests">
            <div className="flex flex-col">
              {repoGroups.map((repoGroup) => {
                const repoEntry = repoEntries[normalizeRepoKey(repoGroup.repositoryName)];

                return (
                  <PRRepoGroup
                    key={repoGroup.repositoryName}
                    onClone={() =>
                      dispatch(reposActions.cloneRepo({ fullName: repoGroup.repositoryName }))
                    }
                    onLocate={() =>
                      dispatch(reposActions.locateRepo({ fullName: repoGroup.repositoryName }))
                    }
                    repoEntry={repoEntry}
                    repoGroup={repoGroup}
                  />
                );
              })}
            </div>
          </ScrollArea>
        ) : null}
      </div>
    </div>
  );
};

interface PullRequestRepoGroup {
  pullRequests: PullRequestSummary[];
  repositoryName: string;
}

interface PRRepoGroupProps {
  onClone: () => void;
  onLocate: () => void;
  repoEntry?: RepoRegistryEntry;
  repoGroup: PullRequestRepoGroup;
}

const PRRepoGroup = ({
  onClone,
  onLocate,
  repoEntry,
  repoGroup,
}: PRRepoGroupProps): React.JSX.Element => {
  const isBusy = repoEntry?.status === "cloning" || repoEntry?.status === "locating";

  return (
    <section className="border-b last:border-b-0">
      <header className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <h2 className="truncate font-mono text-sm font-semibold">{repoGroup.repositoryName}</h2>
          <div className="mt-1 flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
            <span>{formatPullRequestCount(repoGroup.pullRequests.length)} requesting review</span>
            {repoEntry?.localPath ? (
              <span className="truncate font-mono">{repoEntry.localPath}</span>
            ) : null}
            {repoEntry?.error ? <span className="text-destructive">{repoEntry.error}</span> : null}
          </div>
        </div>
        <div
          aria-label={`${repoGroup.repositoryName} repository setup`}
          className="flex flex-wrap justify-end gap-2"
        >
          <Button disabled={isBusy} onClick={onClone} size="xs" type="button" variant="outline">
            {repoEntry?.status === "cloning" ? "Cloning..." : "Clone"}
          </Button>
          <Button disabled={isBusy} onClick={onLocate} size="xs" type="button" variant="outline">
            {repoEntry?.status === "locating" ? "Locating..." : "Locate"}
          </Button>
        </div>
      </header>
      <div className="flex flex-col border-t">
        {repoGroup.pullRequests.map((pullRequest, index) => {
          const worktree = repoEntry?.worktrees?.find(
            (entry) => entry.branch === pullRequest.headRefName,
          );

          return (
            <Fragment key={pullRequest.reference}>
              <PRListItem pullRequest={pullRequest} worktree={worktree} />
              {index < repoGroup.pullRequests.length - 1 ? <Separator /> : null}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
};

interface PRListItemProps {
  pullRequest: PullRequestSummary;
  worktree: RepoWorktreeEntry | undefined;
}

const PRListItem = ({ pullRequest, worktree }: PRListItemProps): React.JSX.Element => {
  const reviewPath = `/pr/${pullRequest.owner}/${pullRequest.repo}/${pullRequest.number}`;

  return (
    <article>
      <Link
        className={cn(
          "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 text-foreground",
          "transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        to={reviewPath}
      >
        <Avatar size="sm">
          {pullRequest.author.avatarUrl ? (
            <AvatarImage alt={`@${pullRequest.author.login}`} src={pullRequest.author.avatarUrl} />
          ) : null}
          <AvatarFallback>{getAvatarFallback(pullRequest.author.login)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium leading-snug">{pullRequest.title}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {pullRequest.author.login} updated {formatUpdatedAt(pullRequest.updatedAt)}
          </p>
          {worktree ? (
            <p className="truncate font-mono text-xs text-muted-foreground">
              worktree: {worktree.path}
            </p>
          ) : null}
        </div>
        <Badge className="justify-self-end" variant="secondary">
          #{pullRequest.number}
        </Badge>
      </Link>
    </article>
  );
};

const PRListSkeleton = (): React.JSX.Element => (
  <div className="flex flex-col gap-3" aria-label="Loading pull requests">
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-24 w-full" />
  </div>
);

const groupPullRequestsByRepository = (
  pullRequests: PullRequestSummary[],
): PullRequestRepoGroup[] => {
  const groups = new Map<string, PullRequestSummary[]>();

  for (const pullRequest of pullRequests) {
    groups.set(pullRequest.repositoryName, [
      ...(groups.get(pullRequest.repositoryName) ?? []),
      pullRequest,
    ]);
  }

  return Array.from(groups, ([repositoryName, groupPullRequests]) => ({
    pullRequests: groupPullRequests,
    repositoryName,
  }));
};

const formatPullRequestCount = (count: number): string => (count === 1 ? "1 PR" : `${count} PRs`);

const getAvatarFallback = (login: string): string => login.slice(0, 2).toUpperCase() || "?";

const formatUpdatedAt = (updatedAt: string): string => {
  const timestamp = Date.parse(updatedAt);

  if (Number.isNaN(timestamp)) {
    return "at an unknown time";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
};
