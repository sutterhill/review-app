import { describe, expect, it } from "vitest";

import { authActions, authReducer } from "./auth-slice";

describe("authReducer", () => {
  it("starts idle without authentication details", () => {
    const state = authReducer(undefined, { type: "unknown" });

    expect(state.status).toBe("idle");
    expect(state.deviceFlow).toBeNull();
    expect(state.error).toBeNull();
  });

  it("tracks authenticated sources", () => {
    const state = authReducer(undefined, authActions.authenticated({ source: "gh" }));

    expect(state.status).toBe("authenticated");
    expect(state.source).toBe("gh");
  });

  it("stores only user-facing device flow fields", () => {
    const state = authReducer(
      undefined,
      authActions.startDeviceFlowSucceeded({
        expiresAt: "2026-05-20T00:10:00.000Z",
        interval: 5,
        userCode: "ABCD-1234",
        verificationUri: "https://github.com/login/device",
      }),
    );

    expect(state.status).toBe("polling");
    expect(JSON.stringify(state)).not.toContain("device_code");
  });
});
