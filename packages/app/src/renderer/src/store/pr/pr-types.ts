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

export interface PullRequestComment {
  author: GitHubAccount;
  body: string;
  createdAt: string;
  id: number;
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

export interface PullRequestSummary {
  author: GitHubAccount;
  headRefName: string;
  htmlUrl: string;
  number: number;
  owner: string;
  reference: string;
  repo: string;
  repositoryName: string;
  title: string;
  updatedAt: string;
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

export interface PrState {
  comments: PullRequestComment[];
  commentsError: PrFetchError | null;
  commentsStatus: PrRequestStatus;
  data: PullRequestData | null;
  error: PrFetchError | null;
  openPullRequests: PullRequestSummary[];
  openPullRequestsError: PrFetchError | null;
  openPullRequestsStatus: PrRequestStatus;
  reference: string;
  status: PrRequestStatus;
}
