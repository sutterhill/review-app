import type { PayloadAction } from "@reduxjs/toolkit";
import { eventChannel, type EventChannel } from "redux-saga";
import { all, call, put, take, takeLatest } from "redux-saga/effects";

import {
  startOrchestratorAgentSession,
  type OrchestratorAgentEvent,
  type OrchestratorAgentSessionRequest,
} from "../../../services/agent-orchestrator";
import { orchestratorActions, SYNTHESIS_SESSION_KEY } from "../orchestrator-slice";
import type {
  OrchestratorRepoRequest,
  OrchestratorSessionResult,
  OrchestratorWorkflowRequest,
} from "../orchestrator-types";

export function createOrchestratorAgentChannel(
  request: OrchestratorAgentSessionRequest,
): EventChannel<OrchestratorAgentEvent> {
  return eventChannel((emit) => {
    const controller = startOrchestratorAgentSession(request, emit);
    return () => controller.abort();
  });
}

export function* runOrchestratorWorkflowSaga(
  action: PayloadAction<OrchestratorWorkflowRequest>,
): Generator {
  if (action.payload.repos.length === 0) {
    yield put(orchestratorActions.workflowFailed("Add at least one repository to review."));
    return;
  }

  try {
    const reviews = (yield all(
      action.payload.repos.map((repo) => call(runRepoReviewSessionSaga, repo)),
    )) as OrchestratorSessionResult[];
    const synthesisCwd = reviews[0]?.cwd ?? action.payload.repos[0]?.cwd ?? "";
    const synthesisRepoKey = action.payload.synthesisRepoKey ?? SYNTHESIS_SESSION_KEY;

    yield put(orchestratorActions.startSynthesis({ cwd: synthesisCwd, repoKey: synthesisRepoKey }));

    const synthesis = (yield call(runSynthesisSessionSaga, {
      cwd: synthesisCwd,
      prompt: formatSynthesisPrompt(reviews, action.payload.synthesisPrompt),
      repoKey: synthesisRepoKey,
    })) as OrchestratorSessionResult;

    yield put(orchestratorActions.workflowSucceeded(synthesis.result));
  } catch (error) {
    yield put(
      orchestratorActions.workflowFailed(
        error instanceof Error ? error.message : "Cross-repo orchestration failed.",
      ),
    );
  }
}

export function* runRepoReviewSessionSaga(repo: OrchestratorRepoRequest): Generator {
  return (yield call(runAgentSessionSaga, repo.repoKey, {
    cwd: repo.cwd,
    prompt: repo.prompt,
    tools: repo.tools,
  })) as OrchestratorSessionResult;
}

export function* runSynthesisSessionSaga(
  request: OrchestratorRepoRequest,
): Generator<unknown, OrchestratorSessionResult, unknown> {
  return (yield call(runAgentSessionSaga, request.repoKey, {
    cwd: request.cwd,
    prompt: request.prompt,
    tools: request.tools,
  })) as OrchestratorSessionResult;
}

export function* runAgentSessionSaga(
  repoKey: string,
  request: OrchestratorAgentSessionRequest,
): Generator<unknown, OrchestratorSessionResult, unknown> {
  let channel: EventChannel<OrchestratorAgentEvent> | null = null;

  try {
    channel = (yield call(
      createOrchestratorAgentChannel,
      request,
    )) as EventChannel<OrchestratorAgentEvent>;

    while (true) {
      const event = (yield take(channel)) as OrchestratorAgentEvent;

      if (event.type === "started") {
        yield put(orchestratorActions.sessionStarted({ repoKey, sessionId: event.sessionId }));
      } else if (event.type === "chunk") {
        yield put(orchestratorActions.appendSessionOutput({ content: event.content, repoKey }));
      } else if (event.type === "error") {
        yield put(orchestratorActions.sessionFailed({ error: event.error, repoKey }));
        throw new Error(event.error);
      } else {
        const result = { cwd: request.cwd, repoKey, result: event.result };
        yield put(orchestratorActions.sessionSucceeded(result));
        return result;
      }
    }
  } finally {
    channel?.close();
  }
}

export function* orchestratorSaga(): Generator {
  yield all([takeLatest(orchestratorActions.startWorkflow.type, runOrchestratorWorkflowSaga)]);
}

const formatSynthesisPrompt = (
  reviews: OrchestratorSessionResult[],
  synthesisPrompt?: string,
): string => {
  const reviewSections = reviews
    .map((review) => `## ${review.repoKey}\nRepository: ${review.cwd}\n\n${review.result}`)
    .join("\n\n");

  return `${synthesisPrompt ?? "Generate a unified cross-repository PR narrative walkthrough."}

Connect related backend/frontend or package changes, call out integration risks, and summarize coordinated test coverage.

Repo review findings:
${reviewSections}`;
};
