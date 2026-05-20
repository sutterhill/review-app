export type OrchestratorAgentEvent =
  | { sessionId: string; type: "started" }
  | { content: string; type: "chunk" }
  | { result: string; type: "done" }
  | { error: string; type: "error" };

export interface OrchestratorAgentController {
  abort: () => void;
}

export interface OrchestratorAgentSessionRequest {
  cwd: string;
  prompt: string;
  tools?: string[];
}

export const startOrchestratorAgentSession = (
  request: OrchestratorAgentSessionRequest,
  onEvent: (event: OrchestratorAgentEvent) => void,
): OrchestratorAgentController => {
  if (typeof window === "undefined" || !window.reviewAppOrchestrator) {
    throw new Error("Agent orchestrator API is unavailable.");
  }

  return window.reviewAppOrchestrator.run(request, onEvent);
};
