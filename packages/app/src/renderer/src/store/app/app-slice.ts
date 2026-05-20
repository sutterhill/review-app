import { createSlice } from "@reduxjs/toolkit";

import type { AppState } from "./app-types";

const initialState: AppState = {
  name: "Review App",
};

export const appSlice = createSlice({
  initialState,
  name: "app",
  reducers: {},
});

export const appReducer = appSlice.reducer;
