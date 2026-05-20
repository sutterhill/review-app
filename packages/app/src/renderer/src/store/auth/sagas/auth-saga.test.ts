import { call, put } from "redux-saga/effects";
import { describe, expect, it } from "vitest";

import { getAuthStatus } from "../../../services/auth";
import { authActions } from "../auth-slice";
import { checkAuthSaga } from "./auth-saga";

describe("checkAuthSaga", () => {
  it("accepts an existing GitHub CLI session", () => {
    const generator = checkAuthSaga();

    expect(generator.next().value).toEqual(call(getAuthStatus));
    expect(generator.next({ authenticated: true, source: "gh" }).value).toEqual(
      put(authActions.authenticated({ source: "gh" })),
    );
    expect(generator.next().done).toBe(true);
  });

  it("moves to unauthenticated when no token exists", () => {
    const generator = checkAuthSaga();

    generator.next();

    expect(generator.next({ authenticated: false, source: "none" }).value).toEqual(
      put(authActions.checkAuthUnauthenticated()),
    );
  });
});
