import type { PullRequestData, PullRequestFile, PullRequestMetadata } from "../store/pr/pr-types";

export type ReviewAgentEvent =
  | { content: string; type: "chunk" }
  | { result: string; type: "done" }
  | { error: string; type: "error" };

export interface ReviewAgentController {
  abort: () => void;
}

export interface ReviewAgentFile {
  additions: number;
  deletions: number;
  filename: string;
  patch: string;
  status: PullRequestFile["status"];
}

export interface ReviewAgentRequest {
  files: ReviewAgentFile[];
  metadata: Pick<PullRequestMetadata, "author" | "body" | "labels" | "reference" | "title">;
}

const MAX_PATCH_CHARS = 8000;

export const startReviewAgentSession = (
  request: ReviewAgentRequest,
  onEvent: (event: ReviewAgentEvent) => void,
): ReviewAgentController => {
  if (typeof window === "undefined" || !window.reviewAppReviewAgent) {
    throw new Error("Review agent API is unavailable.");
  }

  return window.reviewAppReviewAgent.run(request, onEvent);
};

export const buildReviewAgentRequest = (pullRequest: PullRequestData): ReviewAgentRequest => ({
  files: pullRequest.files.map((file) => ({
    additions: file.additions,
    deletions: file.deletions,
    filename: file.filename,
    patch: truncatePatch(file.patch),
    status: file.status,
  })),
  metadata: {
    author: pullRequest.metadata.author,
    body: pullRequest.metadata.body,
    labels: pullRequest.metadata.labels,
    reference: pullRequest.metadata.reference,
    title: pullRequest.metadata.title,
  },
});

const truncatePatch = (patch: string): string => {
  if (patch.length <= MAX_PATCH_CHARS) return patch;
  return `${patch.slice(0, MAX_PATCH_CHARS)}\n...diff truncated for review generation...`;
};
