import { describe, expect, it } from "vitest";

import { reposActions, reposReducer } from "./repos-slice";

describe("reposReducer", () => {
  it("starts with an empty serializable registry", () => {
    const state = reposReducer(undefined, { type: "unknown" });

    expect(state).toEqual({ entries: {} });
    expect(() => JSON.stringify(state)).not.toThrow();
  });

  it("tracks clone progress and successful checkout paths", () => {
    const cloning = reposReducer(undefined, reposActions.cloneRepo({ fullName: "Acme/Repo" }));
    const ready = reposReducer(
      cloning,
      reposActions.repoCheckoutSucceeded({ fullName: "acme/repo", localPath: "/repos/repo" }),
    );

    expect(cloning.entries["acme/repo"]?.status).toBe("cloning");
    expect(ready.entries["acme/repo"]).toMatchObject({
      error: null,
      localPath: "/repos/repo",
      status: "ready",
      worktrees: null,
    });
  });

  it("keeps previous local path when a later operation fails", () => {
    const ready = reposReducer(
      undefined,
      reposActions.repoCheckoutSucceeded({ fullName: "acme/repo", localPath: "/repos/repo" }),
    );
    const failed = reposReducer(
      ready,
      reposActions.repoCheckoutFailed({ fullName: "acme/repo", error: "gh failed" }),
    );

    expect(failed.entries["acme/repo"]).toMatchObject({
      error: "gh failed",
      localPath: "/repos/repo",
      status: "failed",
    });
  });

  it("hydrates saved repo paths as ready entries", () => {
    const state = reposReducer(
      undefined,
      reposActions.hydrateRepoRegistry({
        "acme/repo": { fullName: "Acme/Repo", localPath: "/repos/repo" },
      }),
    );

    expect(state.entries["acme/repo"]).toEqual({
      error: null,
      fullName: "Acme/Repo",
      localPath: "/repos/repo",
      status: "ready",
      worktrees: null,
    });
  });

  it("stores discovered worktrees for repo entries", () => {
    const state = reposReducer(
      undefined,
      reposActions.setWorktrees({
        fullName: "Acme/Repo",
        worktrees: [{ branch: "feature-branch", path: "/repos/repo-feature" }],
      }),
    );

    expect(state.entries["acme/repo"]?.worktrees).toEqual([
      { branch: "feature-branch", path: "/repos/repo-feature" },
    ]);
  });
});
