import type {
  GitHubAccount,
  PrErrorCode,
  PullRequestComment,
  PullRequestData,
  PullRequestFile,
  PullRequestFileStatus,
  PullRequestMetadata,
  PullRequestSummary,
} from "../store/pr/pr-types";
import { getGitHubToken } from "./auth";

const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";

export interface PullRequestReference {
  number: number;
  owner: string;
  repo: string;
}

interface GitHubUserResponse {
  avatar_url?: string | null;
  html_url?: string;
  login?: string;
}

interface GitHubLabelResponse {
  name?: string;
}

interface GitHubPullResponse {
  base?: { sha?: string };
  body?: string | null;
  created_at?: string;
  head?: { ref?: string; sha?: string };
  html_url?: string;
  labels?: Array<GitHubLabelResponse | string>;
  number?: number;
  requested_reviewers?: GitHubUserResponse[];
  state?: "closed" | "open";
  title?: string;
  updated_at?: string;
  user?: GitHubUserResponse | null;
}

interface GitHubCommentResponse {
  body?: string | null;
  created_at?: string;
  id?: number;
  updated_at?: string;
  user?: GitHubUserResponse | null;
}

interface GitHubIssueSearchResponse {
  items?: GitHubIssueSearchItem[];
}

interface GitHubIssueSearchItem {
  html_url?: string;
  number?: number;
  repository_url?: string;
  title?: string;
  updated_at?: string;
  user?: GitHubUserResponse | null;
}

interface GitHubFileResponse {
  additions?: number;
  changes?: number;
  deletions?: number;
  filename?: string;
  patch?: string;
  previous_filename?: string;
  status?: string;
}

export class GitHubApiError extends Error {
  constructor(
    readonly code: PrErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export const parsePullRequestReference = (reference: string): PullRequestReference => {
  const match = reference.trim().match(/^([^/\s#]+)\/([^/\s#]+)#([1-9][0-9]*)$/u);

  if (!match?.[1] || !match[2] || !match[3]) {
    throw new GitHubApiError(
      "invalid_reference",
      "Enter a pull request reference in owner/repo#number format.",
    );
  }

  return {
    number: Number.parseInt(match[3], 10),
    owner: match[1],
    repo: match[2],
  };
};

export const fetchPullRequestFromGitHub = async (reference: string): Promise<PullRequestData> => {
  const pullReference = parsePullRequestReference(reference);
  const token = await getGitHubToken();

  if (token.length === 0) {
    throw new GitHubApiError("auth_failed", "Authenticate with GitHub first.", 401);
  }

  const pullPath = createPullPath(pullReference);
  const [pull, files, diff] = await Promise.all([
    requestGitHub<GitHubPullResponse>(pullPath, token),
    fetchPullRequestFiles(pullPath, token),
    requestGitHubText(pullPath, token, "application/vnd.github.v3.diff").catch(() => ""),
  ]);

  return {
    diff,
    files,
    metadata: toPullRequestMetadata(reference, pullReference, pull),
  };
};

export const fetchPullRequestComments = async (
  reference: string,
): Promise<PullRequestComment[]> => {
  const pullReference = parsePullRequestReference(reference);
  const token = await getGitHubToken();

  if (token.length === 0) {
    throw new GitHubApiError("auth_failed", "Authenticate with GitHub first.", 401);
  }

  const path = `/repos/${encodeURIComponent(pullReference.owner)}/${encodeURIComponent(
    pullReference.repo,
  )}/issues/${pullReference.number}/comments`;
  const response = await requestGitHub<GitHubCommentResponse[]>(path, token);
  return response.map(toComment);
};

export const fetchOpenPullRequestsFromGitHub = async (): Promise<PullRequestSummary[]> => {
  const token = await getGitHubToken();

  if (token.length === 0) {
    throw new GitHubApiError("auth_failed", "Authenticate with GitHub first.", 401);
  }

  const user = await requestGitHub<GitHubUserResponse>("/user", token);

  if (!user.login) {
    throw new GitHubApiError("network", "GitHub user profile did not include a login.");
  }

  const query = encodeURIComponent(`is:pr is:open review-requested:${user.login}`);
  const search = await requestGitHub<GitHubIssueSearchResponse>(
    `/search/issues?q=${query}&sort=updated&order=desc&per_page=100`,
    token,
  );

  const summaries = (search.items ?? []).map(toPullRequestSummary).filter(isPullRequestSummary);
  return Promise.all(summaries.map((summary) => fetchPullRequestSummaryHead(summary, token)));
};

export const fetchMyPullRequestsFromGitHub = async (): Promise<PullRequestSummary[]> => {
  const token = await getGitHubToken();

  if (token.length === 0) {
    throw new GitHubApiError("auth_failed", "Authenticate with GitHub first.", 401);
  }

  const user = await requestGitHub<GitHubUserResponse>("/user", token);

  if (!user.login) {
    throw new GitHubApiError("network", "GitHub user profile did not include a login.");
  }

  const query = encodeURIComponent(`is:pr is:open author:${user.login}`);
  const search = await requestGitHub<GitHubIssueSearchResponse>(
    `/search/issues?q=${query}&sort=updated&order=desc&per_page=100`,
    token,
  );

  const summaries = (search.items ?? []).map(toPullRequestSummary).filter(isPullRequestSummary);
  return Promise.all(summaries.map((summary) => fetchPullRequestSummaryHead(summary, token)));
};

const fetchPullRequestSummaryHead = async (
  summary: PullRequestSummary,
  token: string,
): Promise<PullRequestSummary> => {
  const pull = await requestGitHub<GitHubPullResponse>(createPullPath(summary), token);
  return { ...summary, headRefName: pull.head?.ref ?? "" };
};

const fetchPullRequestFiles = async (
  pullPath: string,
  token: string,
): Promise<PullRequestFile[]> => {
  const files: PullRequestFile[] = [];
  let page = 1;
  let pageFiles: PullRequestFile[] = [];

  do {
    const response = await requestGitHub<GitHubFileResponse[]>(
      `${pullPath}/files?per_page=100&page=${page}`,
      token,
    );
    pageFiles = response.map(toPullRequestFile);
    files.push(...pageFiles);
    page += 1;
  } while (pageFiles.length === 100);

  return files;
};

const requestGitHub = async <ResponseBody>(path: string, token: string): Promise<ResponseBody> => {
  const response = await requestGitHubResponse(path, token, "application/vnd.github+json");
  return (await response.json()) as ResponseBody;
};

const requestGitHubText = async (path: string, token: string, accept: string): Promise<string> => {
  const response = await requestGitHubResponse(path, token, accept);
  return response.text();
};

const requestGitHubResponse = async (
  path: string,
  token: string,
  accept: string,
): Promise<Response> => {
  const response = await fetch(`${GITHUB_API_BASE_URL}${path}`, {
    headers: {
      Accept: accept,
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
    },
  });

  if (!response.ok) {
    throw await toGitHubApiError(response);
  }

  return response;
};

const toGitHubApiError = async (response: Response): Promise<GitHubApiError> => {
  const message = await readGitHubErrorMessage(response);
  const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");

  if (response.status === 403 && rateLimitRemaining === "0") {
    return new GitHubApiError("rate_limited", "GitHub API rate limit exceeded.", response.status);
  }

  if (response.status === 401 || response.status === 403) {
    return new GitHubApiError(
      "auth_failed",
      message || "GitHub authentication failed.",
      response.status,
    );
  }

  if (response.status === 404) {
    return new GitHubApiError("not_found", "GitHub pull request was not found.", response.status);
  }

  return new GitHubApiError("network", message || "GitHub API request failed.", response.status);
};

const readGitHubErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { message?: string };
    return typeof body.message === "string" ? body.message : "";
  } catch {
    return "";
  }
};

const createPullPath = ({ number, owner, repo }: PullRequestReference): string =>
  `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`;

const toPullRequestMetadata = (
  reference: string,
  pullReference: PullRequestReference,
  pull: GitHubPullResponse,
): PullRequestMetadata => ({
  author: toGitHubAccount(pull.user),
  baseSha: pull.base?.sha ?? "",
  body: pull.body ?? "",
  createdAt: pull.created_at ?? "",
  headRefName: pull.head?.ref ?? "",
  headSha: pull.head?.sha ?? "",
  htmlUrl: pull.html_url ?? "",
  labels: (pull.labels ?? []).map(toLabelName).filter((label) => label.length > 0),
  number: pull.number ?? pullReference.number,
  owner: pullReference.owner,
  reference,
  repo: pullReference.repo,
  reviewers: (pull.requested_reviewers ?? []).map(toGitHubAccount),
  state: pull.state ?? "open",
  title: pull.title ?? "Untitled pull request",
  updatedAt: pull.updated_at ?? "",
});

const toComment = (comment: GitHubCommentResponse): PullRequestComment => ({
  author: toGitHubAccount(comment.user),
  body: comment.body ?? "",
  createdAt: comment.created_at ?? "",
  id: comment.id ?? 0,
  updatedAt: comment.updated_at ?? "",
});

const toPullRequestFile = (file: GitHubFileResponse): PullRequestFile => ({
  additions: file.additions ?? 0,
  changes: file.changes ?? 0,
  deletions: file.deletions ?? 0,
  filename: file.filename ?? "",
  patch: file.patch ?? "",
  previousFilename: file.previous_filename,
  status: normalizeFileStatus(file.status),
});

const toPullRequestSummary = (item: GitHubIssueSearchItem): PullRequestSummary | null => {
  const repository = parseRepositoryUrl(item.repository_url);

  if (!repository || !item.number) {
    return null;
  }

  return {
    author: toGitHubAccount(item.user),
    headRefName: "",
    htmlUrl: item.html_url ?? "",
    number: item.number,
    owner: repository.owner,
    reference: `${repository.owner}/${repository.repo}#${item.number}`,
    repo: repository.repo,
    repositoryName: `${repository.owner}/${repository.repo}`,
    title: item.title ?? "Untitled pull request",
    updatedAt: item.updated_at ?? "",
  };
};

const parseRepositoryUrl = (repositoryUrl: string | undefined): PullRequestReference | null => {
  const match = repositoryUrl?.match(/\/repos\/([^/]+)\/([^/]+)$/u);

  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    number: 0,
    owner: decodeURIComponent(match[1]),
    repo: decodeURIComponent(match[2]),
  };
};

const isPullRequestSummary = (summary: PullRequestSummary | null): summary is PullRequestSummary =>
  summary !== null;

const normalizeFileStatus = (status: string | undefined): PullRequestFileStatus => {
  if (status === "added" || status === "modified" || status === "renamed") {
    return status;
  }

  if (status === "removed") {
    return "deleted";
  }

  return "modified";
};

const toGitHubAccount = (user: GitHubUserResponse | null | undefined): GitHubAccount => ({
  avatarUrl: user?.avatar_url ?? null,
  login: user?.login ?? "unknown",
  url: user?.html_url ?? "",
});

const toLabelName = (label: GitHubLabelResponse | string): string =>
  typeof label === "string" ? label : (label.name ?? "");
