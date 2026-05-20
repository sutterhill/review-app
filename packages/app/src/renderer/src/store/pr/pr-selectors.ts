import type { RootState } from "../store";
import type { PrFetchError, PrRequestStatus, PullRequestData, TokenSaveStatus } from "./pr-types";

export const selectPrData = (state: RootState): PullRequestData | null => state.pr.data;
export const selectPrError = (state: RootState): PrFetchError | null => state.pr.error;
export const selectPrReference = (state: RootState): string => state.pr.reference;
export const selectPrStatus = (state: RootState): PrRequestStatus => state.pr.status;
export const selectTokenSaveStatus = (state: RootState): TokenSaveStatus =>
  state.pr.tokenSaveStatus;
export const selectTokenError = (state: RootState): string | null => state.pr.tokenError;
