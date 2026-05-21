import type { PullRequestData, PullRequestFile, PullRequestMetadata } from "../store/pr/pr-types";

export type WalkthroughAgentEvent =
  | { content: string; type: "chunk" }
  | { type: "done" }
  | { error: string; type: "error" };

export interface WalkthroughAgentController {
  abort: () => void;
}

export interface WalkthroughAgentFile {
  additions: number;
  deletions: number;
  filename: string;
  patch: string;
  status: PullRequestFile["status"];
}

export interface WalkthroughAgentGroup {
  files: WalkthroughAgentFile[];
  title: string;
}

export interface WalkthroughAgentHistoryEntry {
  question: string;
  responseJson: string;
}

export interface WalkthroughAgentRequest {
  followUpQuestion?: string;
  groups: WalkthroughAgentGroup[];
  history?: WalkthroughAgentHistoryEntry[];
  metadata: Pick<PullRequestMetadata, "author" | "body" | "labels" | "reference" | "title">;
}

const MAX_PATCH_CHARS = 6000;

export const startWalkthroughAgentSession = (
  request: WalkthroughAgentRequest,
  onEvent: (event: WalkthroughAgentEvent) => void,
): WalkthroughAgentController => {
  if (typeof window === "undefined" || !window.reviewAppWalkthrough) {
    throw new Error("Walkthrough agent API is unavailable.");
  }

  return window.reviewAppWalkthrough.generate(request, onEvent);
};

export const buildWalkthroughAgentRequest = (
  pullRequest: PullRequestData,
  options?: { followUpQuestion?: string; history?: WalkthroughAgentHistoryEntry[] },
): WalkthroughAgentRequest => ({
  followUpQuestion: options?.followUpQuestion,
  groups: groupPullRequestFiles(pullRequest.files),
  history: options?.history,
  metadata: {
    author: pullRequest.metadata.author,
    body: pullRequest.metadata.body,
    labels: pullRequest.metadata.labels,
    reference: pullRequest.metadata.reference,
    title: pullRequest.metadata.title,
  },
});

const groupPullRequestFiles = (files: PullRequestFile[]): WalkthroughAgentGroup[] => {
  const groups = new Map<string, WalkthroughAgentFile[]>();

  files.forEach((file) => {
    const title = getGroupTitle(file.filename);
    const groupFiles = groups.get(title) ?? [];
    groupFiles.push({
      additions: file.additions,
      deletions: file.deletions,
      filename: file.filename,
      patch: truncatePatch(file.patch),
      status: file.status,
    });
    groups.set(title, groupFiles);
  });

  return Array.from(groups, ([title, groupFiles]) => ({ files: groupFiles, title }));
};

const getGroupTitle = (filename: string): string => filename.split("/")[0] || "root";

const truncatePatch = (patch: string): string => {
  if (patch.length <= MAX_PATCH_CHARS) return patch;
  return `${patch.slice(0, MAX_PATCH_CHARS)}\n...diff truncated for walkthrough generation...`;
};
