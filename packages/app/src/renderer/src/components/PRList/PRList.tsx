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

  useEffect(() => {
    dispatch(prActions.fetchOpenPullRequests());
  }, [dispatch]);

  const isLoading = status === "loading";

  return (
    <section className="panel panel-wide pr-list-panel">
      <div className="pr-list-header">
        <div>
          <p className="eyebrow">Pull requests</p>
          <h1>Your open PRs</h1>
          <p>Choose a pull request to review, then connect a local checkout for agent work.</p>
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
        <p className="empty-state">No open pull requests found for your GitHub account.</p>
      ) : null}
      <div className="pr-list" aria-label="Open pull requests">
        {pullRequests.map((pullRequest) => (
          <PRListItem
            key={pullRequest.reference}
            onClone={() =>
              dispatch(reposActions.cloneRepo({ fullName: pullRequest.repositoryName }))
            }
            onLocate={() =>
              dispatch(reposActions.locateRepo({ fullName: pullRequest.repositoryName }))
            }
            pullRequest={pullRequest}
            repoEntry={repoEntries[normalizeRepoKey(pullRequest.repositoryName)]}
          />
        ))}
      </div>
    </section>
  );
};

interface PRListItemProps {
  onClone: () => void;
  onLocate: () => void;
  pullRequest: PullRequestSummary;
  repoEntry?: RepoRegistryEntry;
}

const PRListItem = ({
  onClone,
  onLocate,
  pullRequest,
  repoEntry,
}: PRListItemProps): React.JSX.Element => {
  const isBusy = repoEntry?.status === "cloning" || repoEntry?.status === "locating";
  const reviewPath = `/pr/${pullRequest.owner}/${pullRequest.repo}/${pullRequest.number}`;

  return (
    <article className="pr-list-item">
      <Link className="pr-list-link" to={reviewPath}>
        <span className="repo-name">{pullRequest.repositoryName}</span>
        <h2>{pullRequest.title}</h2>
        <p>
          {pullRequest.author.login} updated {formatUpdatedAt(pullRequest.updatedAt)}
        </p>
      </Link>
      <div className="repo-actions">
        {repoEntry?.localPath ? <p className="repo-path">{repoEntry.localPath}</p> : null}
        {repoEntry?.error ? <p className="error repo-error">{repoEntry.error}</p> : null}
        <button className="diff-toggle" disabled={isBusy} onClick={onClone} type="button">
          {repoEntry?.status === "cloning" ? "Cloning..." : "Clone"}
        </button>
        <button className="diff-toggle" disabled={isBusy} onClick={onLocate} type="button">
          {repoEntry?.status === "locating" ? "Locating..." : "Locate"}
        </button>
      </div>
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
