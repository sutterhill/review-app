import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { WalkthroughState } from "./walkthrough-types";

const initialState: WalkthroughState = {
  content: "",
  error: null,
  status: "idle",
};

export const walkthroughSlice = createSlice({
  initialState,
  name: "walkthrough",
  reducers: {
    appendWalkthroughChunk(state, action: PayloadAction<string>) {
      state.content += action.payload;
      state.error = null;
      state.status = "streaming";
    },
    generateWalkthrough(state) {
      state.content = "";
      state.error = null;
      state.status = "loading";
    },
    generateWalkthroughFailed(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.status = "failed";
    },
    generateWalkthroughSucceeded(state) {
      state.error = null;
      state.status = "succeeded";
    },
    loadCachedWalkthrough(state) {
      state.error = null;
      state.status = "loading";
    },
    loadCachedWalkthroughNotFound(state) {
      state.error = null;
      state.status = "idle";
    },
    loadCachedWalkthroughSucceeded(state, action: PayloadAction<string>) {
      state.content = action.payload;
      state.error = null;
      state.status = "succeeded";
    },
    resetWalkthrough(state) {
      state.content = "";
      state.error = null;
      state.status = "idle";
    },
  },
});

export const walkthroughActions = walkthroughSlice.actions;
export const walkthroughReducer = walkthroughSlice.reducer;
export const GENERATE_WALKTHROUGH = walkthroughActions.generateWalkthrough.type;
