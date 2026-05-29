import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type {
  PrFetchError,
  PrListMode,
  PrState,
  PullRequestComment,
  PullRequestData,
  PullRequestSummary,
} from "./pr-types";

const initialState: PrState = {
  comments: [],
  commentsError: null,
  commentsStatus: "idle",
  data: null,
  error: null,
  myPullRequests: [],
  myPullRequestsError: null,
  myPullRequestsStatus: "idle",
  openPullRequests: [],
  openPullRequestsError: null,
  openPullRequestsStatus: "idle",
  prListMode: "needs-review",
  readyToMergePullRequests: [],
  reference: "",
  status: "idle",
  waitingError: null,
  waitingOnAuthorPullRequests: [],
  waitingStatus: "idle",
};

export const prSlice = createSlice({
  initialState,
  name: "pr",
  reducers: {
    fetchPr(state, action: PayloadAction<string>) {
      state.comments = [];
      state.commentsError = null;
      state.commentsStatus = "idle";
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
      state.commentsError = null;
      state.commentsStatus = "loading";
    },
    fetchComments(state) {
      state.commentsError = null;
      state.commentsStatus = "loading";
    },
    fetchCommentsFailed(state, action: PayloadAction<PrFetchError>) {
      state.commentsError = action.payload;
      state.commentsStatus = "failed";
    },
    fetchCommentsSucceeded(state, action: PayloadAction<PullRequestComment[]>) {
      state.comments = action.payload;
      state.commentsError = null;
      state.commentsStatus = "succeeded";
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
    fetchMyPullRequests(state) {
      state.myPullRequestsError = null;
      state.myPullRequestsStatus = "loading";
    },
    fetchMyPullRequestsFailed(state, action: PayloadAction<PrFetchError>) {
      state.myPullRequestsError = action.payload;
      state.myPullRequestsStatus = "failed";
    },
    fetchMyPullRequestsSucceeded(state, action: PayloadAction<PullRequestSummary[]>) {
      state.myPullRequests = action.payload;
      state.myPullRequestsError = null;
      state.myPullRequestsStatus = "succeeded";
    },
    fetchWaitingPullRequests(state) {
      state.waitingError = null;
      state.waitingStatus = "loading";
    },
    fetchWaitingPullRequestsFailed(state, action: PayloadAction<PrFetchError>) {
      state.waitingError = action.payload;
      state.waitingStatus = "failed";
    },
    fetchWaitingPullRequestsSucceeded(
      state,
      action: PayloadAction<{
        readyToMerge: PullRequestSummary[];
        waitingOnAuthor: PullRequestSummary[];
      }>,
    ) {
      state.readyToMergePullRequests = action.payload.readyToMerge;
      state.waitingOnAuthorPullRequests = action.payload.waitingOnAuthor;
      state.waitingError = null;
      state.waitingStatus = "succeeded";
    },
    setPrListMode(state, action: PayloadAction<PrListMode>) {
      state.prListMode = action.payload;
    },
  },
});

export const prActions = prSlice.actions;
export const prReducer = prSlice.reducer;
export const FETCH_PR = prActions.fetchPr.type;
