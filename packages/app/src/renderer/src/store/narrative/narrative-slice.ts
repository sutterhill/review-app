import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { NarrativeState } from "./narrative-types";

const initialState: NarrativeState = {
  content: "",
  error: null,
  status: "idle",
};

export const narrativeSlice = createSlice({
  initialState,
  name: "narrative",
  reducers: {
    appendNarrativeChunk(state, action: PayloadAction<string>) {
      state.content += action.payload;
      state.error = null;
      state.status = "streaming";
    },
    generateNarrative(state) {
      state.content = "";
      state.error = null;
      state.status = "loading";
    },
    generateNarrativeFailed(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.status = "failed";
    },
    generateNarrativeSucceeded(state) {
      state.error = null;
      state.status = "succeeded";
    },
    loadCachedNarrative(state) {
      state.error = null;
      state.status = "loading";
    },
    loadCachedNarrativeNotFound(state) {
      state.error = null;
      state.status = "idle";
    },
    loadCachedNarrativeSucceeded(state, action: PayloadAction<string>) {
      state.content = action.payload;
      state.error = null;
      state.status = "succeeded";
    },
    resetNarrative(state) {
      state.content = "";
      state.error = null;
      state.status = "idle";
    },
  },
});

export const narrativeActions = narrativeSlice.actions;
export const narrativeReducer = narrativeSlice.reducer;
export const GENERATE_NARRATIVE = narrativeActions.generateNarrative.type;
