export type OrchestratorSessionStatus = "failed" | "idle" | "running" | "streaming" | "succeeded";

export type OrchestratorWorkflowStatus = "failed" | "idle" | "running" | "succeeded";

export interface OrchestratorRepoRequest {
  cwd: string;
  prompt: string;
  repoKey: string;
  tools?: string[];
}

export interface OrchestratorWorkflowRequest {
  repos: OrchestratorRepoRequest[];
  synthesisPrompt?: string;
  synthesisRepoKey?: string;
}

export interface OrchestratorSessionState {
  cwd: string;
  error: string | null;
  output: string;
  repoKey: string;
  result: string | null;
  sessionId: string | null;
  status: OrchestratorSessionStatus;
}

export interface WorkflowState {
  error: string | null;
  narrative: string;
  repoKeys: string[];
  status: OrchestratorWorkflowStatus;
  synthesisSessionKey: string | null;
}

export interface OrchestratorState {
  sessions: Record<string, OrchestratorSessionState>;
  workflow: WorkflowState;
}

export interface OrchestratorSessionResult {
  cwd: string;
  repoKey: string;
  result: string;
}
