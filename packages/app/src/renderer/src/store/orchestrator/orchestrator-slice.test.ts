import { describe, expect, it } from "vitest";

import { orchestratorActions, orchestratorReducer } from "./orchestrator-slice";

describe("orchestratorReducer", () => {
  it("starts with serializable idle workflow state", () => {
    const state = orchestratorReducer(undefined, { type: "unknown" });

    expect(state).toEqual({
      sessions: {},
      workflow: {
        error: null,
        walkthrough: "",
        repoKeys: [],
        status: "idle",
        synthesisSessionKey: null,
      },
    });
    expect(() => JSON.stringify(state)).not.toThrow();
  });

  it("initializes one serializable session per repo when workflow starts", () => {
    const state = orchestratorReducer(
      undefined,
      orchestratorActions.startWorkflow({
        repos: [
          { cwd: "/repos/api", prompt: "Review API", repoKey: "api" },
          { cwd: "/repos/web", prompt: "Review web", repoKey: "web" },
        ],
      }),
    );

    expect(state.workflow).toMatchObject({
      repoKeys: ["api", "web"],
      status: "running",
    });
    expect(state.sessions.api).toMatchObject({ cwd: "/repos/api", repoKey: "api" });
    expect(state.sessions.web).toMatchObject({ cwd: "/repos/web", repoKey: "web" });
    expect(JSON.stringify(state)).not.toContain("abort");
  });

  it("streams output and stores final session result", () => {
    const started = orchestratorReducer(
      undefined,
      orchestratorActions.startWorkflow({
        repos: [{ cwd: "/repos/api", prompt: "Review API", repoKey: "api" }],
      }),
    );
    const streaming = orchestratorReducer(
      started,
      orchestratorActions.appendSessionOutput({ content: "Finding", repoKey: "api" }),
    );
    const completed = orchestratorReducer(
      streaming,
      orchestratorActions.sessionSucceeded({
        cwd: "/repos/api",
        repoKey: "api",
        result: "Finding",
      }),
    );

    expect(streaming.sessions.api?.output).toBe("Finding");
    expect(streaming.sessions.api?.status).toBe("streaming");
    expect(completed.sessions.api?.result).toBe("Finding");
    expect(completed.sessions.api?.status).toBe("succeeded");
  });
});
