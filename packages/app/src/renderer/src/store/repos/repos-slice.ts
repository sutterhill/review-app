import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type {
  RepoCheckoutFailure,
  RepoCheckoutRequest,
  RepoCheckoutResult,
  RepoCheckoutStatus,
  RepoRegistryEntry,
  ReposState,
} from "./repos-types";

const initialState: ReposState = {
  entries: {},
};

export const reposSlice = createSlice({
  initialState,
  name: "repos",
  reducers: {
    cloneRepo(state, action: PayloadAction<RepoCheckoutRequest>) {
      setRepoStatus(state, action.payload.fullName, "cloning");
    },
    locateRepo(state, action: PayloadAction<RepoCheckoutRequest>) {
      setRepoStatus(state, action.payload.fullName, "locating");
    },
    repoCheckoutCancelled(state, action: PayloadAction<RepoCheckoutRequest>) {
      setRepoStatus(state, action.payload.fullName, "idle");
    },
    repoCheckoutFailed(state, action: PayloadAction<RepoCheckoutFailure>) {
      const entry = getOrCreateEntry(state, action.payload.fullName);
      entry.error = action.payload.error;
      entry.status = "failed";
    },
    repoCheckoutSucceeded(state, action: PayloadAction<RepoCheckoutResult>) {
      const entry = getOrCreateEntry(state, action.payload.fullName);
      entry.error = null;
      entry.localPath = action.payload.localPath;
      entry.status = "ready";
    },
  },
});

const setRepoStatus = (state: ReposState, fullName: string, status: RepoCheckoutStatus): void => {
  const entry = getOrCreateEntry(state, fullName);
  entry.error = null;
  entry.status = status;
};

const getOrCreateEntry = (state: ReposState, fullName: string): RepoRegistryEntry => {
  const key = normalizeRepoKey(fullName);
  state.entries[key] ??= {
    error: null,
    fullName,
    localPath: null,
    status: "idle",
  };

  return state.entries[key];
};

export const normalizeRepoKey = (fullName: string): string => fullName.trim().toLowerCase();
export const reposActions = reposSlice.actions;
export const reposReducer = reposSlice.reducer;
