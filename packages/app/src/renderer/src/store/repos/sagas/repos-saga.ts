import type { PayloadAction } from "@reduxjs/toolkit";
import { all, call, put, select, takeLatest } from "redux-saga/effects";

import { cloneRepository, locateRepository } from "../../../services/repo-manager";
import { readLocalJson, writeLocalJson } from "../../../services/runtime";
import { selectRepoEntries } from "../repos-selectors";
import { reposActions } from "../repos-slice";
import type {
  RepoCheckoutRequest,
  RepoRegistryEntry,
  RepoWorktreeEntry,
  SavedRepoRegistry,
} from "../repos-types";

const WEB_REPO_REGISTRY_KEY = "review-app.repo-registry";

export const loadRepoRegistryFromDisk = async (): Promise<SavedRepoRegistry> => {
  if (typeof window === "undefined" || !window.reviewAppRepos) {
    return readLocalJson<SavedRepoRegistry>(WEB_REPO_REGISTRY_KEY, {});
  }

  return window.reviewAppRepos.loadRegistry();
};

export const saveRepoRegistryToDisk = async (entries: SavedRepoRegistry): Promise<void> => {
  if (typeof window === "undefined" || !window.reviewAppRepos) {
    writeLocalJson(WEB_REPO_REGISTRY_KEY, entries);
    return;
  }

  await window.reviewAppRepos.saveRegistry(entries);
};

export const listRepoWorktrees = async (localPath: string): Promise<RepoWorktreeEntry[]> => {
  if (typeof window === "undefined" || !window.reviewAppRepos) {
    return [];
  }

  return window.reviewAppRepos.listWorktrees(localPath);
};

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

export function* loadSavedReposSaga(): Generator {
  const entries = (yield call(loadRepoRegistryFromDisk)) as SavedRepoRegistry;
  yield put(reposActions.hydrateRepoRegistry(entries));
}

export function* loadRepoWorktreesSaga(action: PayloadAction<SavedRepoRegistry>): Generator {
  for (const entry of Object.values(action.payload)) {
    const worktrees = (yield call(listRepoWorktrees, entry.localPath)) as RepoWorktreeEntry[];
    yield put(reposActions.setWorktrees({ fullName: entry.fullName, worktrees }));
  }
}

export function* saveRepoRegistrySaga(): Generator {
  const entries = (yield select(selectRepoEntries)) as Record<string, RepoRegistryEntry>;
  const savedEntries = Object.fromEntries(
    Object.entries(entries)
      .filter(([, entry]) => entry.localPath)
      .map(([key, entry]) => [
        key,
        { fullName: entry.fullName, localPath: entry.localPath as string },
      ]),
  );

  yield call(saveRepoRegistryToDisk, savedEntries);
}

export function* reposSaga(): Generator {
  yield all([
    takeLatest(reposActions.cloneRepo.type, cloneRepoSaga),
    takeLatest(reposActions.hydrateRepoRegistry.type, loadRepoWorktreesSaga),
    takeLatest(reposActions.loadSavedRepos.type, loadSavedReposSaga),
    takeLatest(reposActions.locateRepo.type, locateRepoSaga),
    takeLatest(reposActions.repoCheckoutSucceeded.type, saveRepoRegistrySaga),
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
