import { afterEach, describe, expect, it, vi } from "vitest";

import { getGitHubToken } from "./auth";
import {
  GitHubApiError,
  fetchMyPullRequestsFromGitHub,
  fetchOpenPullRequestsFromGitHub,
  fetchPullRequestComments,
  fetchPullRequestFromGitHub,
  parsePullRequestReference,
} from "./github";

vi.mock("./auth", () => ({
  getGitHubToken: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("parsePullRequestReference", () => {
  it("parses owner/repo#number references", () => {
    expect(parsePullRequestReference("augment/review-app#123")).toEqual({
      number: 123,
      owner: "augment",
      repo: "review-app",
    });
  });

  it("rejects unsupported reference formats", () => {
    expect(() =>
      parsePullRequestReference("https://github.com/augment/review-app/pull/123"),
    ).toThrow(GitHubApiError);
  });
});

describe("fetchPullRequestFromGitHub", () => {
  it("fetches pull request metadata, diff text, and all file pages", async () => {
    vi.mocked(getGitHubToken).mockResolvedValue("github-token");
    const fetchMock = mockFetch((url, init) => {
      const accept = new Headers(init?.headers).get("Accept");

      if (url.endsWith("/files?per_page=100&page=1")) {
        return jsonResponse(Array.from({ length: 100 }, (_, index) => gitHubFile(index)));
      }

      if (url.endsWith("/files?per_page=100&page=2")) {
        return jsonResponse([{ ...gitHubFile(100), status: "removed" }]);
      }

      if (accept === "application/vnd.github.v3.diff") {
        return textResponse("diff --git a/src/app.ts b/src/app.ts");
      }

      return jsonResponse({
        base: { sha: "base-sha" },
        body: "Adds app value.",
        created_at: "2026-05-20T00:00:00.000Z",
        head: { ref: "feature-branch", sha: "head-sha" },
        html_url: "https://github.com/acme/repo/pull/42",
        labels: [{ name: "feature" }, "review"],
        number: 42,
        requested_reviewers: [{ login: "reviewer", html_url: "https://github.com/reviewer" }],
        state: "open",
        title: "Add app value",
        updated_at: "2026-05-21T00:00:00.000Z",
        user: { avatar_url: null, html_url: "https://github.com/octocat", login: "octocat" },
      });
    });

    const data = await fetchPullRequestFromGitHub("acme/repo#42");

    expect(data.metadata).toMatchObject({
      author: { login: "octocat" },
      baseSha: "base-sha",
      headRefName: "feature-branch",
      headSha: "head-sha",
      labels: ["feature", "review"],
      number: 42,
      reference: "acme/repo#42",
      reviewers: [{ login: "reviewer" }],
      title: "Add app value",
    });
    expect(data.diff).toBe("diff --git a/src/app.ts b/src/app.ts");
    expect(data.files).toHaveLength(101);
    expect(data.files[100]).toMatchObject({ filename: "src/file-100.ts", status: "deleted" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/repo/pulls/42/files?per_page=100&page=2",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer github-token" }),
      }),
    );
  });

  it("returns metadata and files with an empty diff when the diff request fails", async () => {
    vi.mocked(getGitHubToken).mockResolvedValue("github-token");
    mockFetch((url, init) => {
      const accept = new Headers(init?.headers).get("Accept");

      if (url.endsWith("/files?per_page=100&page=1")) {
        return jsonResponse([gitHubFile(0)]);
      }

      if (url.endsWith("/files?per_page=100&page=2")) {
        return jsonResponse([]);
      }

      if (accept === "application/vnd.github.v3.diff") {
        return jsonResponse({ message: "Diff is too large." }, { status: 422 });
      }

      return jsonResponse({
        base: { sha: "base-sha" },
        head: { ref: "feature-branch", sha: "head-sha" },
        number: 42,
        title: "Add app value",
      });
    });

    await expect(fetchPullRequestFromGitHub("acme/repo#42")).resolves.toMatchObject({
      diff: "",
      files: [{ filename: "src/file-0.ts" }],
      metadata: {
        baseSha: "base-sha",
        headRefName: "feature-branch",
        headSha: "head-sha",
        number: 42,
      },
    });
  });
});

describe("fetchOpenPullRequestsFromGitHub", () => {
  it("fetches open pull request summaries requesting review from the authenticated user", async () => {
    vi.mocked(getGitHubToken).mockResolvedValue("github-token");
    mockFetch((url) => {
      if (url.endsWith("/user")) {
        return jsonResponse({ login: "octocat" });
      }

      if (url.endsWith("/repos/acme/repo/pulls/5")) {
        return jsonResponse({ head: { ref: "feature-branch" } });
      }

      expect(url).toContain("review-requested%3Aoctocat");
      return jsonResponse({
        items: [
          {
            html_url: "https://github.com/acme/repo/pull/5",
            number: 5,
            repository_url: "https://api.github.com/repos/acme/repo",
            title: "Open change",
            updated_at: "2026-05-21T00:00:00.000Z",
            user: { avatar_url: null, html_url: "https://github.com/octocat", login: "octocat" },
          },
          { number: 6, title: "Missing repository URL" },
        ],
      });
    });

    await expect(fetchOpenPullRequestsFromGitHub()).resolves.toEqual([
      {
        author: { avatarUrl: null, login: "octocat", url: "https://github.com/octocat" },
        headRefName: "feature-branch",
        htmlUrl: "https://github.com/acme/repo/pull/5",
        number: 5,
        owner: "acme",
        reference: "acme/repo#5",
        repo: "repo",
        repositoryName: "acme/repo",
        title: "Open change",
        updatedAt: "2026-05-21T00:00:00.000Z",
      },
    ]);
  });
});

describe("fetchMyPullRequestsFromGitHub", () => {
  it("fetches open pull request summaries authored by the authenticated user", async () => {
    vi.mocked(getGitHubToken).mockResolvedValue("github-token");
    mockFetch((url) => {
      if (url.endsWith("/user")) {
        return jsonResponse({ login: "octocat" });
      }

      if (url.endsWith("/repos/acme/repo/pulls/7")) {
        return jsonResponse({ head: { ref: "my-feature" } });
      }

      expect(url).toContain("author%3Aoctocat");
      return jsonResponse({
        items: [
          {
            html_url: "https://github.com/acme/repo/pull/7",
            number: 7,
            repository_url: "https://api.github.com/repos/acme/repo",
            title: "My change",
            updated_at: "2026-05-21T00:00:00.000Z",
            user: { avatar_url: null, html_url: "https://github.com/octocat", login: "octocat" },
          },
        ],
      });
    });

    await expect(fetchMyPullRequestsFromGitHub()).resolves.toMatchObject([
      {
        headRefName: "my-feature",
        number: 7,
        reference: "acme/repo#7",
        title: "My change",
      },
    ]);
  });
});

describe("fetchPullRequestComments", () => {
  it("fetches issue comments for a pull request", async () => {
    vi.mocked(getGitHubToken).mockResolvedValue("github-token");
    const fetchMock = mockFetch((url) => {
      expect(url).toBe("https://api.github.com/repos/acme/repo/issues/42/comments");
      return jsonResponse([
        {
          body: "Looks good.",
          created_at: "2026-05-21T00:00:00.000Z",
          id: 100,
          updated_at: "2026-05-21T01:00:00.000Z",
          user: { avatar_url: null, html_url: "https://github.com/reviewer", login: "reviewer" },
        },
      ]);
    });

    await expect(fetchPullRequestComments("acme/repo#42")).resolves.toEqual([
      {
        author: { avatarUrl: null, login: "reviewer", url: "https://github.com/reviewer" },
        body: "Looks good.",
        createdAt: "2026-05-21T00:00:00.000Z",
        id: 100,
        updatedAt: "2026-05-21T01:00:00.000Z",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/repo/issues/42/comments",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer github-token" }),
      }),
    );
  });
});

describe("GitHub API error classification", () => {
  it.each([
    { code: "auth_failed", message: "Bad credentials", status: 401 },
    {
      code: "rate_limited",
      message: "GitHub API rate limit exceeded.",
      status: 403,
      remaining: "0",
    },
    { code: "not_found", message: "GitHub pull request was not found.", status: 404 },
    { code: "network", message: "Server unavailable", status: 503 },
  ] as const)(
    "classifies $status responses as $code",
    async ({ code, message, remaining, status }) => {
      vi.mocked(getGitHubToken).mockResolvedValue("github-token");
      mockFetch(() => jsonResponse({ message }, { status }, remaining));

      await expect(fetchOpenPullRequestsFromGitHub()).rejects.toMatchObject({
        code,
        message,
        status,
      });
    },
  );
});

const mockFetch = (
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
): ReturnType<typeof vi.fn> => {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const jsonResponse = (
  body: unknown,
  init: ResponseInit = {},
  rateLimitRemaining?: string,
): Response => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (rateLimitRemaining !== undefined) {
    headers.set("x-ratelimit-remaining", rateLimitRemaining);
  }

  return new Response(JSON.stringify(body), { ...init, headers });
};

const textResponse = (body: string): Response => new Response(body, { status: 200 });

const gitHubFile = (index: number) => ({
  additions: 1,
  changes: 2,
  deletions: 1,
  filename: `src/file-${index}.ts`,
  patch: `@@ -1 +1 @@\n-export const value = ${index};\n+export const value = ${index + 1};`,
  status: "modified",
});
