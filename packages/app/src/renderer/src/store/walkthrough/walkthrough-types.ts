export type WalkthroughStatus = "failed" | "idle" | "loading" | "streaming" | "succeeded";

export interface WalkthroughState {
  content: string;
  error: string | null;
  status: WalkthroughStatus;
}
