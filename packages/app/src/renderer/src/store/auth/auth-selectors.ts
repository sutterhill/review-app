import type { RootState } from "../store";
import type { AuthSource, AuthStatus, DeviceFlowPrompt } from "./auth-types";

export const selectAuthStatus = (state: RootState): AuthStatus => state.auth.status;
export const selectAuthError = (state: RootState): string | null => state.auth.error;
export const selectAuthSource = (state: RootState): AuthSource => state.auth.source;
export const selectDeviceFlow = (state: RootState): DeviceFlowPrompt | null =>
  state.auth.deviceFlow;
export const selectIsAuthenticated = (state: RootState): boolean =>
  state.auth.status === "authenticated";
