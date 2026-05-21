import { call, put, select } from "redux-saga/effects";
import { describe, expect, it } from "vitest";

import { cloneRepository, locateRepository } from "../../../services/repo-manager";
import { selectRepoEntries } from "../repos-selectors";
import { reposActions } from "../repos-slice";
import {
  cloneRepoSaga,
  listRepoWorktrees,
  loadRepoRegistryFromDisk,
  loadRepoWorktreesSaga,
  loadSavedReposSaga,
  locateRepoSaga,
  saveRepoRegistrySaga,
  saveRepoRegistryToDisk,
} from "./repos-saga";

describe("reposSaga", () => {
  it("stores the cloned repository path", () => {
    const generator = cloneRepoSaga(reposActions.cloneRepo({ fullName: "acme/repo" }));

    expect(generator.next().value).toEqual(call(cloneRepository, "acme/repo"));
    expect(generator.next("/repos/repo").value).toEqual(
      put(reposActions.repoCheckoutSucceeded({ fullName: "acme/repo", localPath: "/repos/repo" })),
    );
    expect(generator.next().done).toBe(true);
  });

  it("cancels locate when the dialog is dismissed", () => {
    const generator = locateRepoSaga(reposActions.locateRepo({ fullName: "acme/repo" }));

    expect(generator.next().value).toEqual(call(locateRepository));
    expect(generator.next(null).value).toEqual(
      put(reposActions.repoCheckoutCancelled({ fullName: "acme/repo" })),
    );
    expect(generator.next().done).toBe(true);
  });

  it("surfaces clone failures", () => {
    const generator = cloneRepoSaga(reposActions.cloneRepo({ fullName: "acme/repo" }));

    expect(generator.next().value).toEqual(call(cloneRepository, "acme/repo"));
    expect(generator.throw(new Error("gh repo clone failed")).value).toEqual(
      put(
        reposActions.repoCheckoutFailed({
          error: "gh repo clone failed",
          fullName: "acme/repo",
        }),
      ),
    );
    expect(generator.next().done).toBe(true);
  });

  it("hydrates entries loaded from disk", () => {
    const generator = loadSavedReposSaga();
    const entries = { "acme/repo": { fullName: "acme/repo", localPath: "/repos/repo" } };

    expect(generator.next().value).toEqual(call(loadRepoRegistryFromDisk));
    expect(generator.next(entries).value).toEqual(put(reposActions.hydrateRepoRegistry(entries)));
    expect(generator.next().done).toBe(true);
  });

  it("saves ready entries with local paths", () => {
    const generator = saveRepoRegistrySaga();
    const entries = {
      "acme/failed": {
        error: "failed",
        fullName: "acme/failed",
        localPath: null,
        status: "failed" as const,
        worktrees: null,
      },
      "acme/repo": {
        error: null,
        fullName: "acme/repo",
        localPath: "/repos/repo",
        status: "ready" as const,
        worktrees: [{ branch: "feature-branch", path: "/repos/repo-feature" }],
      },
    };

    expect(generator.next().value).toEqual(select(selectRepoEntries));
    expect(generator.next(entries).value).toEqual(
      call(saveRepoRegistryToDisk, {
        "acme/repo": { fullName: "acme/repo", localPath: "/repos/repo" },
      }),
    );
    expect(generator.next().done).toBe(true);
  });

  it("loads worktrees for hydrated repo paths", () => {
    const entries = { "acme/repo": { fullName: "acme/repo", localPath: "/repos/repo" } };
    const worktrees = [{ branch: "feature-branch", path: "/repos/repo-feature" }];
    const generator = loadRepoWorktreesSaga(reposActions.hydrateRepoRegistry(entries));

    expect(generator.next().value).toEqual(call(listRepoWorktrees, "/repos/repo"));
    expect(generator.next(worktrees).value).toEqual(
      put(reposActions.setWorktrees({ fullName: "acme/repo", worktrees })),
    );
    expect(generator.next().done).toBe(true);
  });
});
