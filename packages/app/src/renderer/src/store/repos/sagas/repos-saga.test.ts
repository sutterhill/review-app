import { call, put } from "redux-saga/effects";
import { describe, expect, it } from "vitest";

import { cloneRepository, locateRepository } from "../../../services/repo-manager";
import { reposActions } from "../repos-slice";
import { cloneRepoSaga, locateRepoSaga } from "./repos-saga";

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
});
