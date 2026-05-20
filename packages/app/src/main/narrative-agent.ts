import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
  type AgentSession,
  type AgentSessionEvent,
} from "@earendil-works/pi-coding-agent";
import type { WebContents } from "electron";

interface NarrativeAgentFile {
  additions: number;
  deletions: number;
  filename: string;
  patch: string;
  status: string;
}

interface NarrativeAgentGroup {
  files: NarrativeAgentFile[];
  title: string;
}

export interface NarrativeAgentRequest {
  groups: NarrativeAgentGroup[];
  metadata: {
    author: { login: string };
    body: string;
    labels: string[];
    reference: string;
    title: string;
  };
}

const activeSessions = new Map<string, AgentSession>();

const SYSTEM_PROMPT = `You generate pull request narrative walkthroughs.
Write concise markdown with these sections:
1. Problem statement
2. Change summary
3. Walkthrough by change group
4. Review notes
Reference real filenames from the supplied diff context. Do not invent files, tests, or behavior.`;

export const generateNarrativeAgentSession = async (
  requestId: string,
  request: NarrativeAgentRequest,
  webContents: WebContents,
): Promise<void> => {
  const { session } = await createNarrativeSession();
  activeSessions.set(requestId, session);
  let failed = false;

  const unsubscribe = session.subscribe((event) => {
    failed = streamNarrativeEvent(requestId, event, webContents) || failed;
  });

  try {
    await session.prompt(formatNarrativePrompt(request));
    if (!failed) {
      sendNarrativeEvent(requestId, webContents, { type: "done" });
    }
  } catch (error) {
    sendNarrativeEvent(requestId, webContents, {
      error: error instanceof Error ? error.message : "Narrative generation failed.",
      type: "error",
    });
  } finally {
    unsubscribe();
    session.dispose();
    activeSessions.delete(requestId);
  }
};

export const abortNarrativeAgentSession = async (requestId: string): Promise<void> => {
  const session = activeSessions.get(requestId);

  if (!session) {
    return;
  }

  await session.abort();
};

const createNarrativeSession = async (): Promise<{ session: AgentSession }> => {
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
    noTools: "all",
    resourceLoader,
    sessionManager: SessionManager.inMemory(cwd),
  });
};

const streamNarrativeEvent = (
  requestId: string,
  event: AgentSessionEvent,
  webContents: WebContents,
): boolean => {
  if (event.type !== "message_update") {
    return false;
  }

  const messageEvent = event.assistantMessageEvent;

  if (messageEvent.type === "text_delta") {
    sendNarrativeEvent(requestId, webContents, { content: messageEvent.delta, type: "chunk" });
    return false;
  }

  if (messageEvent.type === "error") {
    sendNarrativeEvent(requestId, webContents, {
      error: messageEvent.error.errorMessage ?? "Narrative generation failed.",
      type: "error",
    });
    return true;
  }

  return false;
};

const sendNarrativeEvent = (
  requestId: string,
  webContents: WebContents,
  event: { content: string; type: "chunk" } | { type: "done" } | { error: string; type: "error" },
): void => {
  if (!webContents.isDestroyed()) {
    webContents.send(`narrative:stream:${requestId}`, event);
  }
};

const formatNarrativePrompt = ({ groups, metadata }: NarrativeAgentRequest): string => {
  const groupSections = groups.map(formatGroup).join("\n\n");

  return `Generate a PR narrative walkthrough for ${metadata.reference}.

Title: ${metadata.title}
Author: ${metadata.author.login}
Labels: ${metadata.labels.join(", ") || "none"}

PR description:
${metadata.body || "No PR description provided."}

Changed file groups:
${groupSections}`;
};

const formatGroup = (group: NarrativeAgentGroup): string => {
  const files = group.files
    .map(
      (file) => `### ${file.filename}
Status: ${file.status}; +${file.additions}/-${file.deletions}

\`\`\`diff
${file.patch || "No patch available."}
\`\`\``,
    )
    .join("\n\n");

  return `## ${group.title}\n${files}`;
};
