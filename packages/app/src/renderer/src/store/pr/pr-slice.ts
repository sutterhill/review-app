import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { PrFetchError, PrState, PullRequestData } from "./pr-types";

const initialState: PrState = {
  data: null,
  error: null,
  hasGitHubToken: false,
  reference: "",
  status: "idle",
  tokenError: null,
  tokenSaveStatus: "idle",
};

export const prSlice = createSlice({
  initialState,
  name: "pr",
  reducers: {
    fetchPr(state, action: PayloadAction<string>) {
      state.data = null;
      state.error = null;
      state.reference = action.payload;
      state.status = "loading";
    },
    fetchPrFailed(state, action: PayloadAction<PrFetchError>) {
      state.error = action.payload;
      state.status = "failed";
    },
    fetchPrSucceeded(state, action: PayloadAction<PullRequestData>) {
      state.data = action.payload;
      state.error = null;
      state.status = "succeeded";
    },
    saveGitHubToken(state, action: PayloadAction<string>) {
      state.hasGitHubToken = action.payload.trim().length > 0;
      state.tokenError = null;
      state.tokenSaveStatus = "saving";
    },
    saveGitHubTokenFailed(state, action: PayloadAction<string>) {
      state.tokenError = action.payload;
      state.tokenSaveStatus = "failed";
    },
    saveGitHubTokenSucceeded(state) {
      state.tokenError = null;
      state.tokenSaveStatus = "saved";
    },
  },
});

export const prActions = prSlice.actions;
export const prReducer = prSlice.reducer;
export const FETCH_PR = prActions.fetchPr.type;
