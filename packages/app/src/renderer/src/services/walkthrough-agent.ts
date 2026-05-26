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
    return startBrowserWalkthroughSession(request, onEvent);
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

const startBrowserWalkthroughSession = (
  request: WalkthroughAgentRequest,
  onEvent: (event: WalkthroughAgentEvent) => void,
): WalkthroughAgentController => {
  let aborted = false;

  window.setTimeout(() => {
    if (aborted) return;
    onEvent({ content: JSON.stringify(createBrowserWalkthrough(request)), type: "chunk" });
    if (!aborted) onEvent({ type: "done" });
  }, 0);

  return {
    abort: (): void => {
      aborted = true;
    },
  };
};

const createBrowserWalkthrough = (request: WalkthroughAgentRequest) => {
  const files = request.groups.flatMap((group) => group.files);
  const topFiles = files.slice(0, 6).map((file) => file.filename);
  const changedFileCount = files.length;
  const totalAdditions = files.reduce((sum, file) => sum + file.additions, 0);
  const totalDeletions = files.reduce((sum, file) => sum + file.deletions, 0);

  return {
    description: `${request.metadata.title} changes ${changedFileCount} file${
      changedFileCount === 1 ? "" : "s"
    } with ${totalAdditions} additions and ${totalDeletions} deletions. This browser walkthrough is generated from the PR metadata and diff structure.`,
    groups: request.groups.map((group) => ({
      filePaths: group.files.map((file) => file.filename),
      title: group.title,
    })),
    steps: [
      {
        body: [
          `The PR is authored by ${request.metadata.author.login} and is organized around ${request.groups.length} file group${request.groups.length === 1 ? "" : "s"}.`,
          request.metadata.body
            ? `The PR description says: ${request.metadata.body.slice(0, 500)}`
            : "No PR description was provided.",
        ].join("\n\n"),
        heading: "Review the pull request intent",
        relevantFiles: topFiles.map((path) => ({ path })),
      },
      ...request.groups.slice(0, 5).map((group) => ({
        body: `This group includes ${group.files.length} changed file${
          group.files.length === 1 ? "" : "s"
        }: ${group.files.map((file) => `\`${file.filename}\``).join(", ")}.`,
        heading: `Inspect ${group.title} changes`,
        relevantFiles: group.files.map((file) => ({ path: file.filename })),
      })),
    ],
    suggestedQuestions: [
      "Which files changed the most?",
      "What risks should I check first?",
      "Show me the changed files by area.",
    ],
  };
};
