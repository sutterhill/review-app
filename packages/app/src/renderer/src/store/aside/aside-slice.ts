import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { AsideState } from "./aside-types";

const initialState: AsideState = {
  references: [],
  status: "idle",
};

export const asideSlice = createSlice({
  initialState,
  name: "aside",
  reducers: {
    hydrateAside(state, action: PayloadAction<string[]>) {
      // Merge persisted references with anything already in state so that
      // setAside calls made during the initial loadAside window are preserved.
      state.references = dedupe([...action.payload, ...state.references]);
      state.status = "ready";
    },
    loadAside(state) {
      state.status = "loading";
    },
    removeAside(state, action: PayloadAction<string>) {
      state.references = state.references.filter((reference) => reference !== action.payload);
    },
    setAside(state, action: PayloadAction<string>) {
      state.references = dedupe([...state.references, action.payload]);
    },
  },
});

const dedupe = (references: string[]): string[] => [...new Set(references)];

export const asideActions = asideSlice.actions;
export const asideReducer = asideSlice.reducer;
