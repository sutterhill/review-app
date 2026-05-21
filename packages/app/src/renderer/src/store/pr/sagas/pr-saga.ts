import type { PayloadAction } from "@reduxjs/toolkit";
import { all, call, put, select, takeLatest } from "redux-saga/effects";

import {
  GitHubApiError,
  fetchMyPullRequestsFromGitHub,
  fetchOpenPullRequestsFromGitHub,
  fetchPullRequestComments,
  fetchPullRequestFromGitHub,
} from "../../../services/github";
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
    yield put(prActions.fetchPrSucceeded(data));
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
