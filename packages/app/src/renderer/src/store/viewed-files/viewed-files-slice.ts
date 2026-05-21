import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { ViewedFilesState } from "./viewed-files-types";

const initialState: ViewedFilesState = {
  byReference: {},
};

export const viewedFilesSlice = createSlice({
  initialState,
  name: "viewedFiles",
  reducers: {
    hydrateViewedFiles(state, action: PayloadAction<{ paths: string[]; prReference: string }>) {
      state.byReference[action.payload.prReference] = dedupe(action.payload.paths);
    },
    loadViewedFiles(_state, _action: PayloadAction<{ prReference: string }>) {},
    setViewed(
      state,
      action: PayloadAction<{ path: string; prReference: string; viewed: boolean }>,
    ) {
      const current = state.byReference[action.payload.prReference] ?? [];
      const next = action.payload.viewed
        ? dedupe([...current, action.payload.path])
        : current.filter((path) => path !== action.payload.path);
      state.byReference[action.payload.prReference] = next;
    },
  },
});

const dedupe = (paths: string[]): string[] => [...new Set(paths)];

export const viewedFilesActions = viewedFilesSlice.actions;
export const viewedFilesReducer = viewedFilesSlice.reducer;
