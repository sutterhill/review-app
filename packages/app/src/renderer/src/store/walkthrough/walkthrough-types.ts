export type WalkthroughStatus = "failed" | "idle" | "loading" | "streaming" | "succeeded";

export type LineRange = [number, number];

export interface WalkthroughFileRef {
  lineRanges?: LineRange[];
  path: string;
}

export interface WalkthroughGroup {
  filePaths: string[];
  title: string;
}

export interface WalkthroughStep {
  body: string;
  heading: string;
  relevantFiles: WalkthroughFileRef[];
}

export interface WalkthroughResponse {
  description: string;
  groups: WalkthroughGroup[];
  steps: WalkthroughStep[];
  suggestedQuestions: string[];
}

export type WalkthroughMessageKind = "follow-up" | "initial";

export interface WalkthroughMessage {
  id: string;
  kind: WalkthroughMessageKind;
  parsed: null | WalkthroughResponse;
  question?: string;
  raw: string;
  status: WalkthroughStatus;
}

export interface WalkthroughState {
  error: string | null;
  messages: WalkthroughMessage[];
  status: WalkthroughStatus;
}
