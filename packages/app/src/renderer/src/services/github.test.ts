import { describe, expect, it } from "vitest";

import { GitHubApiError, parsePullRequestReference } from "./github";

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
