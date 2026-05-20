import type { PayloadAction } from "@reduxjs/toolkit";
import { all, call, put, takeLatest } from "redux-saga/effects";

import {
  GitHubApiError,
  fetchOpenPullRequestsFromGitHub,
  fetchPullRequestFromGitHub,
} from "../../../services/github";
import { prActions } from "../pr-slice";
import type { PrFetchError, PullRequestData, PullRequestSummary } from "../pr-types";

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

export function* prSaga(): Generator {
  yield all([
    takeLatest(prActions.fetchOpenPullRequests.type, fetchOpenPullRequestsSaga),
    takeLatest(prActions.fetchPr.type, fetchPrSaga),
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
