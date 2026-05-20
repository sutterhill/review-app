import type { RootState } from "../store";
import type { OrchestratorSessionState, WorkflowState } from "./orchestrator-types";

export const selectOrchestratorSessions = (
  state: RootState,
): Record<string, OrchestratorSessionState> => state.orchestrator.sessions;

export const selectOrchestratorWorkflow = (state: RootState): WorkflowState =>
  state.orchestrator.workflow;

export const selectCrossRepoNarrative = (state: RootState): string =>
  state.orchestrator.workflow.narrative;
