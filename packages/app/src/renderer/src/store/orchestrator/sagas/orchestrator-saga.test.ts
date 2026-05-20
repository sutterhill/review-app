import type { EventChannel } from "redux-saga";
import { all, call, put, take } from "redux-saga/effects";
import { describe, expect, it, vi } from "vitest";

import type { OrchestratorAgentEvent } from "../../../services/agent-orchestrator";
import { orchestratorActions } from "../orchestrator-slice";
import type { OrchestratorSessionResult, OrchestratorWorkflowRequest } from "../orchestrator-types";
import {
  createOrchestratorAgentChannel,
  runAgentSessionSaga,
  runOrchestratorWorkflowSaga,
  runRepoReviewSessionSaga,
  runSynthesisSessionSaga,
} from "./orchestrator-saga";

const workflowRequest: OrchestratorWorkflowRequest = {
  repos: [
    { cwd: "/repos/api", prompt: "Review API changes", repoKey: "api" },
    { cwd: "/repos/web", prompt: "Review web changes", repoKey: "web" },
  ],
};

describe("runOrchestratorWorkflowSaga", () => {
  it("forks two repo reviews, joins results, and runs synthesis", () => {
    const reviews: OrchestratorSessionResult[] = [
      { cwd: "/repos/api", repoKey: "api", result: "API changed response shape." },
      { cwd: "/repos/web", repoKey: "web", result: "Web consumes response shape." },
    ];
    const synthesis = {
      cwd: "/repos/api",
      repoKey: "synthesis",
      result: "Update API and web together.",
    };
    const generator = runOrchestratorWorkflowSaga(
      orchestratorActions.startWorkflow(workflowRequest),
    );

    expect(generator.next().value).toEqual(
      all(workflowRequest.repos.map((repo) => call(runRepoReviewSessionSaga, repo))),
    );
    expect(generator.next(reviews).value).toEqual(
      put(orchestratorActions.startSynthesis({ cwd: "/repos/api", repoKey: "synthesis" })),
    );
    expect(generator.next().value).toEqual(
      call(runSynthesisSessionSaga, {
        cwd: "/repos/api",
        prompt: expect.stringContaining("API changed response shape."),
        repoKey: "synthesis",
      }),
    );
    expect(generator.next(synthesis).value).toEqual(
      put(orchestratorActions.workflowSucceeded("Update API and web together.")),
    );
    expect(generator.next().done).toBe(true);
  });

  it("fails when no repos are provided", () => {
    const generator = runOrchestratorWorkflowSaga(orchestratorActions.startWorkflow({ repos: [] }));

    expect(generator.next().value).toEqual(
      put(orchestratorActions.workflowFailed("Add at least one repository to review.")),
    );
    expect(generator.next().done).toBe(true);
  });
});

describe("runAgentSessionSaga", () => {
  it("streams session events into Redux and returns the final result", () => {
    const channel = createFakeChannel();
    const generator = runAgentSessionSaga("api", {
      cwd: "/repos/api",
      prompt: "Review API changes",
    });

    expect(generator.next().value).toEqual(
      call(createOrchestratorAgentChannel, { cwd: "/repos/api", prompt: "Review API changes" }),
    );
    expect(generator.next(channel).value).toEqual(take(channel));
    expect(generator.next({ sessionId: "session-1", type: "started" }).value).toEqual(
      put(orchestratorActions.sessionStarted({ repoKey: "api", sessionId: "session-1" })),
    );
    expect(generator.next().value).toEqual(take(channel));
    expect(generator.next({ content: "Finding", type: "chunk" }).value).toEqual(
      put(orchestratorActions.appendSessionOutput({ content: "Finding", repoKey: "api" })),
    );
    expect(generator.next().value).toEqual(take(channel));
    expect(generator.next({ result: "Finding", type: "done" }).value).toEqual(
      put(
        orchestratorActions.sessionSucceeded({
          cwd: "/repos/api",
          repoKey: "api",
          result: "Finding",
        }),
      ),
    );
    expect(generator.next().value).toEqual({
      cwd: "/repos/api",
      repoKey: "api",
      result: "Finding",
    });
    expect(generator.next().done).toBe(true);
    expect(channel.close).toHaveBeenCalledOnce();
  });
});

const createFakeChannel = (): EventChannel<OrchestratorAgentEvent> =>
  ({
    close: vi.fn(),
    flush: vi.fn(),
    take: vi.fn(),
  }) as unknown as EventChannel<OrchestratorAgentEvent>;
