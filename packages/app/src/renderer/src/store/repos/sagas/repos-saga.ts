import type { PayloadAction } from "@reduxjs/toolkit";
import { all, call, put, takeLatest } from "redux-saga/effects";

import { cloneRepository, locateRepository } from "../../../services/repo-manager";
import { reposActions } from "../repos-slice";
import type { RepoCheckoutRequest } from "../repos-types";

export function* cloneRepoSaga(action: PayloadAction<RepoCheckoutRequest>): Generator {
  try {
    const localPath = (yield call(cloneRepository, action.payload.fullName)) as string | null;
    yield* putCheckoutResult(action.payload.fullName, localPath);
  } catch (error) {
    yield put(
      reposActions.repoCheckoutFailed(toRepoCheckoutFailure(action.payload.fullName, error)),
    );
  }
}

export function* locateRepoSaga(action: PayloadAction<RepoCheckoutRequest>): Generator {
  try {
    const localPath = (yield call(locateRepository)) as string | null;
    yield* putCheckoutResult(action.payload.fullName, localPath);
  } catch (error) {
    yield put(
      reposActions.repoCheckoutFailed(toRepoCheckoutFailure(action.payload.fullName, error)),
    );
  }
}

export function* reposSaga(): Generator {
  yield all([
    takeLatest(reposActions.cloneRepo.type, cloneRepoSaga),
    takeLatest(reposActions.locateRepo.type, locateRepoSaga),
  ]);
}

function* putCheckoutResult(fullName: string, localPath: string | null): Generator {
  if (localPath) {
    yield put(reposActions.repoCheckoutSucceeded({ fullName, localPath }));
    return;
  }

  yield put(reposActions.repoCheckoutCancelled({ fullName }));
}

const toRepoCheckoutFailure = (
  fullName: string,
  error: unknown,
): { error: string; fullName: string } => ({
  error: error instanceof Error ? error.message : "Repository checkout failed.",
  fullName,
});
