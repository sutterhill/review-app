import type { PayloadAction } from "@reduxjs/toolkit";
import { all, call, put, takeLatest } from "redux-saga/effects";

import { GitHubApiError, fetchPullRequestFromGitHub } from "../../../services/github";
import { setGitHubToken } from "../../../services/settings";
import { prActions } from "../pr-slice";
import type { PrFetchError, PullRequestData } from "../pr-types";

export function* fetchPrSaga(action: PayloadAction<string>): Generator {
  try {
    const data = (yield call(fetchPullRequestFromGitHub, action.payload)) as PullRequestData;
    yield put(prActions.fetchPrSucceeded(data));
  } catch (error) {
    yield put(prActions.fetchPrFailed(toPrFetchError(error)));
  }
}

export function* saveGitHubTokenSaga(action: PayloadAction<string>): Generator {
  try {
    yield call(setGitHubToken, action.payload);
    yield put(prActions.saveGitHubTokenSucceeded());
  } catch (error) {
    yield put(
      prActions.saveGitHubTokenFailed(
        error instanceof Error ? error.message : "Token save failed.",
      ),
    );
  }
}

export function* prSaga(): Generator {
  yield all([
    takeLatest(prActions.fetchPr.type, fetchPrSaga),
    takeLatest(prActions.saveGitHubToken.type, saveGitHubTokenSaga),
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
