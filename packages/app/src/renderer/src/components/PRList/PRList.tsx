import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router";

import {
  selectOpenPullRequests,
  selectOpenPullRequestsError,
  selectOpenPullRequestsStatus,
} from "../../store/pr/pr-selectors";
import { prActions } from "../../store/pr/pr-slice";
import type { PullRequestSummary } from "../../store/pr/pr-types";
import { selectRepoEntries } from "../../store/repos/repos-selectors";
import { normalizeRepoKey, reposActions } from "../../store/repos/repos-slice";
import type { RepoRegistryEntry } from "../../store/repos/repos-types";
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
    <section className="panel panel-wide pr-list-panel">
      <div className="pr-list-header">
        <div>
          <p className="eyebrow">Review requests</p>
          <h1>Pull requests to review</h1>
          <p>Grouped by repository. Set up each repo once, then open a PR.</p>
        </div>
        <button
          className="button button-secondary"
          disabled={isLoading}
          onClick={() => dispatch(prActions.fetchOpenPullRequests())}
          type="button"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {error ? <p className="error">{error.message}</p> : null}
      {isLoading && pullRequests.length === 0 ? <PRListSkeleton /> : null}
      {!isLoading && pullRequests.length === 0 && !error ? (
        <p className="empty-state">No open pull requests are requesting your review.</p>
      ) : null}
      <div className="pr-repo-groups" aria-label="Open review requests">
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
    </section>
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
    <section className="pr-repo-group">
      <div className="pr-repo-header">
        <div className="pr-repo-summary">
          <h2>{repoGroup.repositoryName}</h2>
          <p>{formatPullRequestCount(repoGroup.pullRequests.length)} requesting review</p>
          {repoEntry?.localPath ? <p className="repo-path">{repoEntry.localPath}</p> : null}
          {repoEntry?.error ? <p className="error repo-error">{repoEntry.error}</p> : null}
        </div>
        <div className="repo-actions" aria-label={`${repoGroup.repositoryName} repository setup`}>
          <button className="diff-toggle" disabled={isBusy} onClick={onClone} type="button">
            {repoEntry?.status === "cloning" ? "Cloning..." : "Clone"}
          </button>
          <button className="diff-toggle" disabled={isBusy} onClick={onLocate} type="button">
            {repoEntry?.status === "locating" ? "Locating..." : "Locate"}
          </button>
        </div>
      </div>
      <div className="pr-list">
        {repoGroup.pullRequests.map((pullRequest) => (
          <PRListItem key={pullRequest.reference} pullRequest={pullRequest} />
        ))}
      </div>
    </section>
  );
};

interface PRListItemProps {
  pullRequest: PullRequestSummary;
}

const PRListItem = ({ pullRequest }: PRListItemProps): React.JSX.Element => {
  const reviewPath = `/pr/${pullRequest.owner}/${pullRequest.repo}/${pullRequest.number}`;

  return (
    <article className="pr-list-item">
      <Link className="pr-list-link" to={reviewPath}>
        <span className="pr-number">#{pullRequest.number}</span>
        <h2>{pullRequest.title}</h2>
        <p>
          {pullRequest.author.login} updated {formatUpdatedAt(pullRequest.updatedAt)}
        </p>
      </Link>
    </article>
  );
};

const PRListSkeleton = (): React.JSX.Element => (
  <div className="pr-list-loading" aria-label="Loading pull requests">
    <span />
    <span />
    <span />
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
