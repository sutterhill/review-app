import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { AuthSource, AuthState, DeviceFlowPrompt } from "./auth-types";

const initialState: AuthState = {
  deviceFlow: null,
  error: null,
  source: "none",
  status: "idle",
};

export const authSlice = createSlice({
  initialState,
  name: "auth",
  reducers: {
    authFailed(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.status = "failed";
    },
    authenticated(state, action: PayloadAction<{ source: AuthSource }>) {
      state.deviceFlow = null;
      state.error = null;
      state.source = action.payload.source;
      state.status = "authenticated";
    },
    checkAuth(state) {
      state.error = null;
      state.status = "checking";
    },
    checkAuthUnauthenticated(state) {
      state.deviceFlow = null;
      state.error = null;
      state.source = "none";
      state.status = "unauthenticated";
    },
    signOut(state) {
      state.error = null;
      state.status = "signing_out";
    },
    signOutSucceeded(state) {
      state.deviceFlow = null;
      state.error = null;
      state.source = "none";
      state.status = "unauthenticated";
    },
    startDeviceFlow(state) {
      state.deviceFlow = null;
      state.error = null;
      state.status = "checking";
    },
    startDeviceFlowSucceeded(state, action: PayloadAction<DeviceFlowPrompt>) {
      state.deviceFlow = action.payload;
      state.error = null;
      state.status = "polling";
    },
    updateDeviceFlowInterval(state, action: PayloadAction<number>) {
      if (state.deviceFlow) {
        state.deviceFlow.interval = action.payload;
      }
    },
  },
});

export const authActions = authSlice.actions;
export const authReducer = authSlice.reducer;
