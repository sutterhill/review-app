import type { PayloadAction } from "@reduxjs/toolkit";
import { all, call, put, select, takeLatest } from "redux-saga/effects";

import {
  GitHubApiError,
  fetchMyPullRequestsFromGitHub,
  fetchOpenPullRequestsFromGitHub,
  fetchPullRequestComments,
  fetchPullRequestFromGitHub,
  fetchWaitingPullRequestsFromGitHub,
} from "../../../services/github";
import { generateLocalDiff } from "../../../services/repo-manager";
import { selectRepoEntries } from "../../repos/repos-selectors";
import { normalizeRepoKey } from "../../repos/repos-slice";
import type { RepoRegistryEntry } from "../../repos/repos-types";
import { selectPrReference } from "../pr-selectors";
import { prActions } from "../pr-slice";
import type {
  PrFetchError,
  PullRequestComment,
  PullRequestData,
  PullRequestSummary,
} from "../pr-types";

export function* fetchPrSaga(action: PayloadAction<string>): Generator {
  try {
    const data = (yield call(fetchPullRequestFromGitHub, action.payload)) as PullRequestData;
    let resolvedData = data;

    if (data.diff === "" && data.metadata.baseSha && data.metadata.headSha) {
      const repoKey = normalizeRepoKey(`${data.metadata.owner}/${data.metadata.repo}`);
      const entries = (yield select(selectRepoEntries)) as Record<string, RepoRegistryEntry>;
      const repoEntry = entries[repoKey];

      if (repoEntry?.localPath) {
        const worktree = repoEntry.worktrees?.find(
          (entry) => entry.branch === data.metadata.headRefName,
        );
        const diffPath = worktree?.path ?? repoEntry.localPath;

        try {
          const localDiff = (yield call(
            generateLocalDiff,
            diffPath,
            data.metadata.baseSha,
            data.metadata.headSha,
          )) as string;
          resolvedData = { ...data, diff: localDiff };
        } catch {
          resolvedData = data;
        }
      }
    }

    yield put(prActions.fetchPrSucceeded(resolvedData));
  } catch (error) {
    yield put(prActions.fetchPrFailed(toPrFetchError(error)));
  }
}

export function* fetchOpenPullRequestsSaga(): Generator {
  try {
    const pullRequests = (yield call(fetchOpenPullRequestsFromGitHub)) as PullRequestSummary[];
    yield put(prActions.fetchOpenPullRequestsSucceeded(pullRequests));
  } catch (error) {
    yield put(prActions.fetchOpenPullRequestsFailed(toPrFetchError(error)));
  }
}

export function* fetchMyPullRequestsSaga(): Generator {
  try {
    const pullRequests = (yield call(fetchMyPullRequestsFromGitHub)) as PullRequestSummary[];
    yield put(prActions.fetchMyPullRequestsSucceeded(pullRequests));
  } catch (error) {
    yield put(prActions.fetchMyPullRequestsFailed(toPrFetchError(error)));
  }
}

export function* fetchWaitingPullRequestsSaga(): Generator {
  try {
    const pullRequests = (yield call(fetchWaitingPullRequestsFromGitHub)) as {
      readyToMerge: PullRequestSummary[];
      waitingOnAuthor: PullRequestSummary[];
    };
    yield put(prActions.fetchWaitingPullRequestsSucceeded(pullRequests));
  } catch (error) {
    yield put(prActions.fetchWaitingPullRequestsFailed(toPrFetchError(error)));
  }
}

export function* fetchCommentsSaga(): Generator {
  try {
    const reference = (yield select(selectPrReference)) as string;
    const comments = (yield call(fetchPullRequestComments, reference)) as PullRequestComment[];
    yield put(prActions.fetchCommentsSucceeded(comments));
  } catch (error) {
    yield put(prActions.fetchCommentsFailed(toPrFetchError(error)));
  }
}

export function* prSaga(): Generator {
  yield all([
    takeLatest(prActions.fetchComments.type, fetchCommentsSaga),
    takeLatest(prActions.fetchMyPullRequests.type, fetchMyPullRequestsSaga),
    takeLatest(prActions.fetchOpenPullRequests.type, fetchOpenPullRequestsSaga),
    takeLatest(prActions.fetchPr.type, fetchPrSaga),
    takeLatest(prActions.fetchPrSucceeded.type, fetchCommentsSaga),
    takeLatest(prActions.fetchWaitingPullRequests.type, fetchWaitingPullRequestsSaga),
  ]);
}

const toPrFetchError = (error: unknown): PrFetchError => {
  if (error instanceof GitHubApiError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
    };
  }

  if (error instanceof Error) {
    return {
      code: "network",
      message: error.message,
    };
  }

  return {
    code: "network",
    message: "GitHub API request failed.",
  };
};
