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

export interface NarrativeAgentHistoryEntry {
  question: string;
  responseJson: string;
}

export interface NarrativeAgentRequest {
  followUpQuestion?: string;
  groups: NarrativeAgentGroup[];
  history?: NarrativeAgentHistoryEntry[];
  metadata: {
    author: { login: string };
    body: string;
    labels: string[];
    reference: string;
    title: string;
  };
}

const activeSessions = new Map<string, AgentSession>();

const FAST_MODEL = getModel("anthropic", "claude-haiku-4-5");

const SYSTEM_PROMPT = `You produce a structured walkthrough that helps a human review a pull request. You output exactly one JSON object — no prose before or after, no markdown fences, no explanation.

## Output schema

\`\`\`ts
interface WalkthroughResponse {
  description: string;             // one or two plain sentences summarizing the PR
  groups: Array<{                  // 2-5 semantic groupings of changed files
    title: string;                 // short descriptive title (not file path)
    filePaths: string[];           // file paths in this group
  }>;
  steps: Array<{                   // 3-8 narrative steps, in walkthrough order
    heading: string;               // descriptive heading naming the change, not the file
    body: string;                  // 1-4 short markdown paragraphs of prose
    relevantFiles: Array<{
      path: string;                // file path
      lineRanges?: Array<[number, number]>; // 1-indexed inclusive ranges in NEW file
    }>;
  }>;
  suggestedQuestions: string[];    // 2-4 short follow-up prompts a reviewer might ask
}
\`\`\`

## Rules

- Output only valid JSON. Begin the response with \`{\` and end with \`}\`.
- Every file in \`groups[].filePaths\` must appear at most once across all groups.
- Cover every meaningful file path from the input across the groups, ignoring lockfiles, generated artifacts, pure formatting, and import-only changes.
- Each step's \`relevantFiles\` should list the files (and ideally line ranges) most relevant to that step.
- Inside \`step.body\`, reference code positions with the inline syntax \`{{ref:path/to/file.ts#L10-20}}\` for line ranges, or \`{{ref:path/to/file.ts}}\` for a whole file. They render as clickable chips that expand the file on the right.
- Use plain prose in \`description\`, \`heading\`, and \`body\`. No theater metaphors, no file-by-file march; group related changes into one step when they tell one story.
- Keep \`description\` to 1–2 sentences and \`body\` paragraphs tight.
- Do not exceed ~8 steps.

## Follow-up turns

When the user asks a follow-up question, return the same schema. You may omit \`groups\` (return an empty array) and reuse \`steps\` to answer the question, with \`suggestedQuestions\` proposing further drill-ins.`;

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
  if (!session) return;
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
    model: FAST_MODEL,
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
  if (event.type !== "message_update") return false;
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

const formatNarrativePrompt = ({
  followUpQuestion,
  groups,
  history,
  metadata,
}: NarrativeAgentRequest): string => {
  const groupSections = groups.map(formatGroup).join("\n\n");
  const historySection = history?.length
    ? `\n\nConversation so far (each turn is a JSON walkthrough you produced):\n${history
        .map(
          (entry, index) =>
            `### Turn ${index + 1}\nUser question: ${entry.question || "(initial)"}\nYour response:\n${entry.responseJson}`,
        )
        .join("\n\n")}`
    : "";
  const intro = followUpQuestion
    ? `The reviewer is asking a follow-up about ${metadata.reference}: "${followUpQuestion}". Answer it as a new WalkthroughResponse JSON object. You may set \`groups\` to an empty array.`
    : `Generate a structured walkthrough JSON for ${metadata.reference}.`;

  return `${intro}

Labels: ${metadata.labels.join(", ") || "none"}

PR title: ${metadata.title}
PR description:
${metadata.body || "No PR description provided."}

Changed file groups:
${groupSections}${historySection}

Respond with ONE JSON object matching the WalkthroughResponse schema. Begin with \`{\` and end with \`}\`. No prose before or after.`;
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
