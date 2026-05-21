import type { RootState } from "../store";
import type { WalkthroughStatus } from "./walkthrough-types";

export const selectWalkthroughContent = (state: RootState): string => state.walkthrough.content;
export const selectWalkthroughError = (state: RootState): string | null => state.walkthrough.error;
export const selectWalkthroughStatus = (state: RootState): WalkthroughStatus =>
  state.walkthrough.status;
