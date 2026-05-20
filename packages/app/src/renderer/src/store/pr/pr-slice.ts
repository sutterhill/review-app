import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { PrFetchError, PrState, PullRequestData, PullRequestSummary } from "./pr-types";

const initialState: PrState = {
  data: null,
  error: null,
  openPullRequests: [],
  openPullRequestsError: null,
  openPullRequestsStatus: "idle",
  reference: "",
  status: "idle",
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
    fetchOpenPullRequests(state) {
      state.openPullRequestsError = null;
      state.openPullRequestsStatus = "loading";
    },
    fetchOpenPullRequestsFailed(state, action: PayloadAction<PrFetchError>) {
      state.openPullRequestsError = action.payload;
      state.openPullRequestsStatus = "failed";
    },
    fetchOpenPullRequestsSucceeded(state, action: PayloadAction<PullRequestSummary[]>) {
      state.openPullRequests = action.payload;
      state.openPullRequestsError = null;
      state.openPullRequestsStatus = "succeeded";
    },
  },
});

export const prActions = prSlice.actions;
export const prReducer = prSlice.reducer;
export const FETCH_PR = prActions.fetchPr.type;
