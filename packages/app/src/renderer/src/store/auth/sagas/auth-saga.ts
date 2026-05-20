import { all, call, delay, put, takeLatest } from "redux-saga/effects";

import {
  getAuthStatus,
  pollGitHubDeviceFlow,
  signOutGitHub,
  startGitHubDeviceFlow,
  type AuthStatusResult,
  type GitHubDeviceFlow,
  type GitHubDevicePollResult,
} from "../../../services/auth";
import { authActions } from "../auth-slice";
import type { DeviceFlowPrompt } from "../auth-types";

export function* checkAuthSaga(): Generator {
  try {
    const result = (yield call(getAuthStatus)) as AuthStatusResult;
    if (result.authenticated) {
      yield put(authActions.authenticated({ source: result.source }));
      return;
    }

    yield put(authActions.checkAuthUnauthenticated());
  } catch (error) {
    yield put(authActions.authFailed(toAuthErrorMessage(error)));
  }
}

export function* startDeviceFlowSaga(): Generator {
  try {
    const flow = (yield call(startGitHubDeviceFlow)) as GitHubDeviceFlow;
    let interval = flow.interval;
    yield put(authActions.startDeviceFlowSucceeded(toDeviceFlowPrompt(flow, interval)));

    const expiresAt = Date.now() + flow.expiresIn * 1000;
    while (Date.now() < expiresAt) {
      yield delay(interval * 1000);
      const result = (yield call(pollGitHubDeviceFlow, flow.deviceCode)) as GitHubDevicePollResult;

      if (result.status === "authenticated") {
        yield put(authActions.authenticated({ source: "oauth" }));
        return;
      }

      if (result.status === "slow_down") {
        interval += result.interval ?? 5;
        yield put(authActions.updateDeviceFlowInterval(interval));
      }
    }

    yield put(authActions.authFailed("GitHub device code expired. Start sign-in again."));
  } catch (error) {
    yield put(authActions.authFailed(toAuthErrorMessage(error)));
  }
}

export function* signOutSaga(): Generator {
  try {
    yield call(signOutGitHub);
    yield put(authActions.signOutSucceeded());
  } catch (error) {
    yield put(authActions.authFailed(toAuthErrorMessage(error)));
  }
}

export function* authSaga(): Generator {
  yield all([
    takeLatest(authActions.checkAuth.type, checkAuthSaga),
    takeLatest(authActions.startDeviceFlow.type, startDeviceFlowSaga),
    takeLatest(authActions.signOut.type, signOutSaga),
  ]);
}

const toDeviceFlowPrompt = (flow: GitHubDeviceFlow, interval: number): DeviceFlowPrompt => ({
  expiresAt: new Date(Date.now() + flow.expiresIn * 1000).toISOString(),
  interval,
  userCode: flow.userCode,
  verificationUri: flow.verificationUri,
  verificationUriComplete: flow.verificationUriComplete,
});

const toAuthErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "GitHub authentication failed.";
