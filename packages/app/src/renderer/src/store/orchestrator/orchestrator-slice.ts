import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type {
  OrchestratorSessionResult,
  OrchestratorSessionState,
  OrchestratorState,
  OrchestratorWorkflowRequest,
} from "./orchestrator-types";

const initialState: OrchestratorState = {
  sessions: {},
  workflow: {
    error: null,
    narrative: "",
    repoKeys: [],
    status: "idle",
    synthesisSessionKey: null,
  },
};

export const SYNTHESIS_SESSION_KEY = "synthesis";

export const orchestratorSlice = createSlice({
  initialState,
  name: "orchestrator",
  reducers: {
    appendSessionOutput(state, action: PayloadAction<{ content: string; repoKey: string }>) {
      const session = state.sessions[action.payload.repoKey];

      if (session) {
        session.output += action.payload.content;
        session.status = "streaming";
      }
    },
    startSynthesis(state, action: PayloadAction<{ cwd: string; repoKey?: string }>) {
      const repoKey = action.payload.repoKey ?? SYNTHESIS_SESSION_KEY;
      state.sessions[repoKey] = createSessionState(repoKey, action.payload.cwd);
      state.workflow.synthesisSessionKey = repoKey;
    },
    startWorkflow(state, action: PayloadAction<OrchestratorWorkflowRequest>) {
      state.sessions = Object.fromEntries(
        action.payload.repos.map((repo) => [
          repo.repoKey,
          createSessionState(repo.repoKey, repo.cwd),
        ]),
      );
      state.workflow = {
        error: null,
        narrative: "",
        repoKeys: action.payload.repos.map((repo) => repo.repoKey),
        status: "running",
        synthesisSessionKey: null,
      };
    },
    workflowFailed(state, action: PayloadAction<string>) {
      state.workflow.error = action.payload;
      state.workflow.status = "failed";
    },
    workflowSucceeded(state, action: PayloadAction<string>) {
      state.workflow.error = null;
      state.workflow.narrative = action.payload;
      state.workflow.status = "succeeded";
    },
    sessionFailed(state, action: PayloadAction<{ error: string; repoKey: string }>) {
      const session = state.sessions[action.payload.repoKey];

      if (session) {
        session.error = action.payload.error;
        session.status = "failed";
      }
    },
    sessionStarted(state, action: PayloadAction<{ repoKey: string; sessionId: string }>) {
      const session = state.sessions[action.payload.repoKey];

      if (session) {
        session.sessionId = action.payload.sessionId;
        session.status = "running";
      }
    },
    sessionSucceeded(state, action: PayloadAction<OrchestratorSessionResult>) {
      const session = state.sessions[action.payload.repoKey];

      if (session) {
        session.error = null;
        session.output = action.payload.result;
        session.result = action.payload.result;
        session.status = "succeeded";
      }
    },
  },
});

const createSessionState = (repoKey: string, cwd: string): OrchestratorSessionState => ({
  cwd,
  error: null,
  output: "",
  repoKey,
  result: null,
  sessionId: null,
  status: "idle",
});

export const orchestratorActions = orchestratorSlice.actions;
export const orchestratorReducer = orchestratorSlice.reducer;
export const START_ORCHESTRATOR_WORKFLOW = orchestratorActions.startWorkflow.type;
