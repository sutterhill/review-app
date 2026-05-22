import { getModel } from "@earendil-works/pi-ai";
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
  type AgentSession,
  type AgentSessionEvent,
} from "@earendil-works/pi-coding-agent";
import type { WebContents } from "electron";

interface ReplyAgentComment {
  author: string;
  body: string;
  kind: "agent" | "user";
}

export interface ReplyAgentRequest {
  comments: ReplyAgentComment[];
  filePath: string;
  lineEnd: number;
  lineStart: number;
  patch?: string;
  pr: { reference: string; title: string };
}

type ReplyAgentEvent =
  | { content: string; type: "chunk" }
  | { result: string; type: "done" }
  | { error: string; type: "error" };

const activeSessions = new Map<string, AgentSession>();

const FAST_MODEL = getModel("anthropic", "claude-haiku-4-5");

const SYSTEM_PROMPT = `You are a focused code-review assistant replying to a single inline comment thread on a pull request. The user shows you the file path, line range, the relevant diff hunk if available, and the prior messages in the thread. You write ONE concise, plain-text reply that moves the discussion forward.

## Rules

- Output the reply body only — no JSON, no markdown headings, no code fences around the whole reply.
- 1–4 short sentences. Inline backticks for symbols are fine.
- Be specific. Reference the symbol, function, or value being discussed. Quote short snippets when useful.
- If the previous message asks a question, answer it directly. If it raises a concern, agree, disagree with a reason, or propose a fix.
- Do not invent file content or line numbers that are not in the supplied context.
- If you genuinely cannot help with the limited context, say so briefly and suggest what additional context would unblock you.
- Do NOT echo the user's message back, do NOT restate the diff, and do NOT add a salutation or sign-off.`;

export const generateReplyAgentSession = async (
  requestId: string,
  request: ReplyAgentRequest,
  webContents: WebContents,
): Promise<void> => {
  const { session } = await createReplySession();
  activeSessions.set(requestId, session);
  let failed = false;
  let result = "";

  const unsubscribe = session.subscribe((event) => {
    const streamed = streamReplyEvent(requestId, event, webContents);
    failed = streamed.failed || failed;
    result += streamed.content;
  });

  try {
    const prompt = formatReplyPrompt(request);
    console.log(`[reply-agent ${requestId}] prompt:\n${prompt}\n---`);
    await session.prompt(prompt);
    if (!failed) {
      console.log(`[reply-agent ${requestId}] result:\n${result}\n---`);
      sendReplyEvent(requestId, webContents, { result, type: "done" });
    }
  } catch (error) {
    sendReplyEvent(requestId, webContents, {
      error: error instanceof Error ? error.message : "Reply agent session failed.",
      type: "error",
    });
  } finally {
    unsubscribe();
    session.dispose();
    activeSessions.delete(requestId);
  }
};

export const abortReplyAgentSession = async (requestId: string): Promise<void> => {
  const session = activeSessions.get(requestId);
  if (!session) return;
  await session.abort();
};

const createReplySession = async (): Promise<{ session: AgentSession }> => {
  const cwd = process.cwd();
  const agentDir = getAgentDir();
  const resourceLoader = new DefaultResourceLoader({
    agentDir,
    appendSystemPrompt: [],
    cwd,
    noContextFiles: true,
    noExtensions: true,
    noPromptTemplates: true,
    noSkills: true,
    systemPrompt: SYSTEM_PROMPT,
  });
  await resourceLoader.reload();

  return createAgentSession({
    cwd,
    model: FAST_MODEL,
    noTools: "all",
    resourceLoader,
    sessionManager: SessionManager.inMemory(cwd),
  });
};

const streamReplyEvent = (
  requestId: string,
  event: AgentSessionEvent,
  webContents: WebContents,
): { content: string; failed: boolean } => {
  if (event.type !== "message_update") return { content: "", failed: false };
  const messageEvent = event.assistantMessageEvent;

  if (messageEvent.type === "text_delta") {
    sendReplyEvent(requestId, webContents, { content: messageEvent.delta, type: "chunk" });
    return { content: messageEvent.delta, failed: false };
  }
  if (messageEvent.type === "error") {
    sendReplyEvent(requestId, webContents, {
      error: messageEvent.error.errorMessage ?? "Reply generation failed.",
      type: "error",
    });
    return { content: "", failed: true };
  }
  return { content: "", failed: false };
};

const sendReplyEvent = (
  requestId: string,
  webContents: WebContents,
  event: ReplyAgentEvent,
): void => {
  if (!webContents.isDestroyed()) {
    webContents.send(`reply-agent:stream:${requestId}`, event);
  }
};

const formatReplyPrompt = (request: ReplyAgentRequest): string => {
  const lineRange =
    request.lineStart === request.lineEnd
      ? `line ${request.lineStart}`
      : `lines ${request.lineStart}–${request.lineEnd}`;
  const conversation = request.comments
    .map((entry, index) => `${index + 1}. ${entry.author} (${entry.kind}): ${entry.body}`)
    .join("\n");
  const patchSection = request.patch
    ? `\n\nRelevant diff for ${request.filePath}:\n\`\`\`diff\n${request.patch}\n\`\`\``
    : "";
  return `Pull request ${request.pr.reference} — ${request.pr.title}.

Thread is anchored to ${request.filePath} (${lineRange}).${patchSection}

Conversation so far (oldest first):
${conversation}

Write the next reply as the agent. Output the reply body only.`;
};
