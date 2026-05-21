import { call, delay, put } from "redux-saga/effects";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getAuthStatus,
  pollGitHubDeviceFlow,
  signOutGitHub,
  startGitHubDeviceFlow,
  type GitHubDeviceFlow,
} from "../../../services/auth";
import { authActions } from "../auth-slice";
import { checkAuthSaga, signOutSaga, startDeviceFlowSaga } from "./auth-saga";

const deviceFlow: GitHubDeviceFlow = {
  deviceCode: "device-code",
  expiresIn: 600,
  interval: 5,
  userCode: "ABCD-1234",
  verificationUri: "https://github.com/login/device",
  verificationUriComplete: "https://github.com/login/device?user_code=ABCD-1234",
};

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe("startDeviceFlowSaga", () => {
  it("polls until GitHub authenticates the device flow", () => {
    vi.spyOn(Date, "now").mockReturnValue(0);
    const generator = startDeviceFlowSaga();

    expect(generator.next().value).toEqual(call(startGitHubDeviceFlow));
    expect(generator.next(deviceFlow).value).toEqual(
      put(
        authActions.startDeviceFlowSucceeded({
          expiresAt: "1970-01-01T00:10:00.000Z",
          interval: 5,
          userCode: "ABCD-1234",
          verificationUri: "https://github.com/login/device",
          verificationUriComplete: "https://github.com/login/device?user_code=ABCD-1234",
        }),
      ),
    );
    expect(generator.next().value).toEqual(delay(5_000));
    expect(generator.next().value).toEqual(call(pollGitHubDeviceFlow, "device-code"));
    expect(generator.next({ status: "authenticated" }).value).toEqual(
      put(authActions.authenticated({ source: "oauth" })),
    );
    expect(generator.next().done).toBe(true);
  });

  it("backs off when GitHub returns slow_down", () => {
    vi.spyOn(Date, "now").mockReturnValue(0);
    const generator = startDeviceFlowSaga();

    generator.next();
    generator.next(deviceFlow);

    expect(generator.next().value).toEqual(delay(5_000));
    expect(generator.next().value).toEqual(call(pollGitHubDeviceFlow, "device-code"));
    expect(generator.next({ interval: 3, status: "slow_down" }).value).toEqual(
      put(authActions.updateDeviceFlowInterval(8)),
    );
    expect(generator.next().value).toEqual(delay(8_000));
  });

  it("fails when the device code expires before authentication", () => {
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(2_000);
    const generator = startDeviceFlowSaga();

    generator.next();
    generator.next({ ...deviceFlow, expiresIn: 1, interval: 1 });

    expect(generator.next().value).toEqual(delay(1_000));
    expect(generator.next().value).toEqual(call(pollGitHubDeviceFlow, "device-code"));
    expect(generator.next({ status: "pending" }).value).toEqual(
      put(authActions.authFailed("GitHub device code expired. Start sign-in again.")),
    );
    expect(generator.next().done).toBe(true);
  });
});

describe("signOutSaga", () => {
  it("clears local auth state after signing out of GitHub", () => {
    const generator = signOutSaga();

    expect(generator.next().value).toEqual(call(signOutGitHub));
    expect(generator.next().value).toEqual(put(authActions.signOutSucceeded()));
    expect(generator.next().done).toBe(true);
  });
});
