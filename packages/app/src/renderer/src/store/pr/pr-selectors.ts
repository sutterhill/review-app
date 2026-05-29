import type { RootState } from "../store";
import type {
  PrFetchError,
  PrListMode,
  PrRequestStatus,
  PullRequestComment,
  PullRequestData,
  PullRequestSummary,
} from "./pr-types";

export const selectPrComments = (state: RootState): PullRequestComment[] => state.pr.comments;
export const selectPrCommentsError = (state: RootState): PrFetchError | null =>
  state.pr.commentsError;
export const selectPrCommentsStatus = (state: RootState): PrRequestStatus =>
  state.pr.commentsStatus;
export const selectPrData = (state: RootState): PullRequestData | null => state.pr.data;
export const selectPrError = (state: RootState): PrFetchError | null => state.pr.error;
export const selectPrReference = (state: RootState): string => state.pr.reference;
export const selectPrStatus = (state: RootState): PrRequestStatus => state.pr.status;
export const selectOpenPullRequests = (state: RootState): PullRequestSummary[] =>
  state.pr.openPullRequests;
export const selectOpenPullRequestsError = (state: RootState): PrFetchError | null =>
  state.pr.openPullRequestsError;
export const selectOpenPullRequestsStatus = (state: RootState): PrRequestStatus =>
  state.pr.openPullRequestsStatus;
export const selectMyPullRequests = (state: RootState): PullRequestSummary[] =>
  state.pr.myPullRequests;
export const selectMyPullRequestsError = (state: RootState): PrFetchError | null =>
  state.pr.myPullRequestsError;
export const selectMyPullRequestsStatus = (state: RootState): PrRequestStatus =>
  state.pr.myPullRequestsStatus;
export const selectPrListMode = (state: RootState): PrListMode => state.pr.prListMode;
export const selectReadyToMergePullRequests = (state: RootState): PullRequestSummary[] =>
  state.pr.readyToMergePullRequests;
export const selectWaitingOnAuthorPullRequests = (state: RootState): PullRequestSummary[] =>
  state.pr.waitingOnAuthorPullRequests;
export const selectWaitingStatus = (state: RootState): PrRequestStatus => state.pr.waitingStatus;
export const selectWaitingError = (state: RootState): PrFetchError | null => state.pr.waitingError;
