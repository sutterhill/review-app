export interface GitHubAccount {
  avatarUrl: string | null;
  login: string;
  url: string;
}

export interface PullRequestMetadata {
  author: GitHubAccount;
  body: string;
  createdAt: string;
  htmlUrl: string;
  labels: string[];
  number: number;
  owner: string;
  reference: string;
  repo: string;
  reviewers: GitHubAccount[];
  state: "closed" | "open";
  title: string;
  updatedAt: string;
}

export type PullRequestFileStatus = "added" | "deleted" | "modified" | "renamed";

export interface PullRequestFile {
  additions: number;
  changes: number;
  deletions: number;
  filename: string;
  patch: string;
  previousFilename?: string;
  status: PullRequestFileStatus;
}

export interface PullRequestData {
  diff: string;
  files: PullRequestFile[];
  metadata: PullRequestMetadata;
}

export type PrErrorCode =
  | "auth_failed"
  | "invalid_reference"
  | "network"
  | "not_found"
  | "rate_limited";

export interface PrFetchError {
  code: PrErrorCode;
  message: string;
  status?: number;
}

export type PrRequestStatus = "failed" | "idle" | "loading" | "succeeded";
export type TokenSaveStatus = "failed" | "idle" | "saved" | "saving";

export interface PrState {
  data: PullRequestData | null;
  error: PrFetchError | null;
  hasGitHubToken: boolean;
  reference: string;
  status: PrRequestStatus;
  tokenError: string | null;
  tokenSaveStatus: TokenSaveStatus;
}
