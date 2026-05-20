import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
  type AgentSession,
  type AgentSessionEvent,
} from "@earendil-works/pi-coding-agent";
import type { WebContents } from "electron";

export interface OrchestratorAgentSessionRequest {
  cwd: string;
  prompt: string;
  tools?: string[];
}

type OrchestratorAgentEvent =
  | { sessionId: string; type: "started" }
  | { content: string; type: "chunk" }
  | { result: string; type: "done" }
  | { error: string; type: "error" };

const activeSessions = new Map<string, AgentSession>();

const SYSTEM_PROMPT = `You review repository changes for a cross-repository pull request walkthrough.
Focus on concrete findings, filenames, coupling points, risks, and tests. Be concise and do not invent code that is not present.`;

export const runOrchestratorAgentSession = async (
  requestId: string,
  request: OrchestratorAgentSessionRequest,
  webContents: WebContents,
): Promise<void> => {
  const { session } = await createOrchestratorSession(request);
  activeSessions.set(requestId, session);
  sendOrchestratorEvent(requestId, webContents, { sessionId: session.sessionId, type: "started" });
  let failed = false;
  let result = "";

  const unsubscribe = session.subscribe((event) => {
    const streamed = streamOrchestratorEvent(requestId, event, webContents);
    failed = streamed.failed || failed;
    result += streamed.content;
  });

  try {
    await session.prompt(request.prompt);
    if (!failed) {
      sendOrchestratorEvent(requestId, webContents, { result, type: "done" });
    }
  } catch (error) {
    sendOrchestratorEvent(requestId, webContents, {
      error: error instanceof Error ? error.message : "Orchestrator agent session failed.",
      type: "error",
    });
  } finally {
    unsubscribe();
    session.dispose();
    activeSessions.delete(requestId);
  }
};

export const abortOrchestratorAgentSession = async (requestId: string): Promise<void> => {
  const session = activeSessions.get(requestId);

  if (!session) {
    return;
  }

  await session.abort();
};

const createOrchestratorSession = async (
  request: OrchestratorAgentSessionRequest,
): Promise<{ session: AgentSession }> => {
  const agentDir = getAgentDir();
  const resourceLoader = new DefaultResourceLoader({
    agentDir,
    appendSystemPrompt: [],
    cwd: request.cwd,
    noExtensions: true,
    noPromptTemplates: true,
    noSkills: true,
    systemPrompt: SYSTEM_PROMPT,
  });
  await resourceLoader.reload();

  return createAgentSession({
    cwd: request.cwd,
    resourceLoader,
    sessionManager: SessionManager.inMemory(request.cwd),
    tools: request.tools ?? ["read", "grep", "find", "ls"],
  });
};

const streamOrchestratorEvent = (
  requestId: string,
  event: AgentSessionEvent,
  webContents: WebContents,
): { content: string; failed: boolean } => {
  if (event.type !== "message_update") {
    return { content: "", failed: false };
  }

  const messageEvent = event.assistantMessageEvent;

  if (messageEvent.type === "text_delta") {
    sendOrchestratorEvent(requestId, webContents, { content: messageEvent.delta, type: "chunk" });
    return { content: messageEvent.delta, failed: false };
  }

  if (messageEvent.type === "error") {
    sendOrchestratorEvent(requestId, webContents, {
      error: messageEvent.error.errorMessage ?? "Orchestrator agent session failed.",
      type: "error",
    });
    return { content: "", failed: true };
  }

  return { content: "", failed: false };
};

const sendOrchestratorEvent = (
  requestId: string,
  webContents: WebContents,
  event: OrchestratorAgentEvent,
): void => {
  if (!webContents.isDestroyed()) {
    webContents.send(`orchestrator:stream:${requestId}`, event);
  }
};
