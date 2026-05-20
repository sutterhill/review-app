import type { PullRequestData, PullRequestFile, PullRequestMetadata } from "../store/pr/pr-types";

export type NarrativeAgentEvent =
  | { content: string; type: "chunk" }
  | { type: "done" }
  | { error: string; type: "error" };

export interface NarrativeAgentController {
  abort: () => void;
}

export interface NarrativeAgentFile {
  additions: number;
  deletions: number;
  filename: string;
  patch: string;
  status: PullRequestFile["status"];
}

export interface NarrativeAgentGroup {
  files: NarrativeAgentFile[];
  title: string;
}

export interface NarrativeAgentRequest {
  groups: NarrativeAgentGroup[];
  metadata: Pick<PullRequestMetadata, "author" | "body" | "labels" | "reference" | "title">;
}

const MAX_PATCH_CHARS = 6000;

export const startNarrativeAgentSession = (
  request: NarrativeAgentRequest,
  onEvent: (event: NarrativeAgentEvent) => void,
): NarrativeAgentController => {
  if (typeof window === "undefined" || !window.reviewAppNarrative) {
    throw new Error("Narrative agent API is unavailable.");
  }

  return window.reviewAppNarrative.generate(request, onEvent);
};

export const buildNarrativeAgentRequest = (
  pullRequest: PullRequestData,
): NarrativeAgentRequest => ({
  groups: groupPullRequestFiles(pullRequest.files),
  metadata: {
    author: pullRequest.metadata.author,
    body: pullRequest.metadata.body,
    labels: pullRequest.metadata.labels,
    reference: pullRequest.metadata.reference,
    title: pullRequest.metadata.title,
  },
});

const groupPullRequestFiles = (files: PullRequestFile[]): NarrativeAgentGroup[] => {
  const groups = new Map<string, NarrativeAgentFile[]>();

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
  if (patch.length <= MAX_PATCH_CHARS) {
    return patch;
  }

  return `${patch.slice(0, MAX_PATCH_CHARS)}\n...diff truncated for narrative generation...`;
};
