export type AuthSource = "gh" | "none" | "oauth" | "stored";
export type AuthStatus =
  | "authenticated"
  | "checking"
  | "failed"
  | "idle"
  | "polling"
  | "signing_out"
  | "unauthenticated";

export interface DeviceFlowPrompt {
  expiresAt: string;
  interval: number;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
}

export interface AuthState {
  deviceFlow: DeviceFlowPrompt | null;
  error: string | null;
  source: AuthSource;
  status: AuthStatus;
}
