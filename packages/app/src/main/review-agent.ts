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

interface ReviewAgentFile {
  additions: number;
  deletions: number;
  filename: string;
  patch: string;
  status: string;
}

export interface ReviewAgentRequest {
  files: ReviewAgentFile[];
  metadata: {
    author: { login: string };
    body: string;
    labels: string[];
    reference: string;
    title: string;
  };
}

type ReviewAgentEvent =
  | { content: string; type: "chunk" }
  | { result: string; type: "done" }
  | { error: string; type: "error" };

const activeSessions = new Map<string, AgentSession>();

const FAST_MODEL = getModel("anthropic", "claude-haiku-4-5");

const SYSTEM_PROMPT = `You are an experienced code reviewer for the pull request the user shows you. You leave inline review comments anchored to specific lines of the new (post-change) file. You output exactly one JSON object — no prose before or after, no markdown fences, no explanation.

## Output schema

\`\`\`ts
interface ReviewResponse {
  summary: string;                 // one or two plain sentences summarizing your overall impression
  comments: Array<{
    filePath: string;              // exact path as given in the input
    lineStart: number;             // 1-indexed line on the NEW side
    lineEnd: number;               // 1-indexed line on the NEW side; equal to lineStart for single-line comments
    category:
      | "blocker"                 // must fix before merging (bugs, security, data loss, broken contracts)
      | "concern"                 // should probably address (design smell, risky pattern, missing test)
      | "warning"                 // worth flagging (potential issue, possible edge case)
      | "nit"                     // small style/clarity suggestion, easy to take or leave
      | "praise";                 // genuinely good change worth calling out
    body: string;                  // 1–4 short sentences in plain markdown
  }>;
}
\`\`\`

## Rules

- Only comment on lines that appear as additions (\`+\`) or context lines in the supplied patches; do not invent file paths or line numbers.
- Line numbers MUST refer to the NEW side of the diff. Use the hunk headers (\`@@ -a,b +c,d @@\`) to count: the first line after the header is line c, the next is c+1, etc. Skip removed (\`-\`) lines when counting.
- For a single-line comment set lineEnd = lineStart. For a range covering multiple consecutive lines, set lineStart and lineEnd to the first/last new-side line. Keep ranges tight (≤ ~10 lines).
- Prefer the smallest correct range. Anchor to the most relevant single line when in doubt.
- Be specific. Reference the symbol, function, or value you are commenting on. Quote short snippets with backticks.
- Use \`praise\` sparingly — only when something is genuinely well done. At most a couple per review.
- Use \`blocker\` only when shipping the change would cause a real bug or regression. Don't escalate style.
- Skip pure noise (lockfiles, generated files, formatting-only churn). It's fine to return zero comments for a noise-only file.
- Aim for 3–15 comments total across the PR, scaled to the size of the change. Don't pad with trivia.
- Don't repeat the same point on multiple lines; pick the best anchor.

## Body

- Lead with what the issue or observation is. Then explain why briefly. Suggest a fix when it's obvious.
- Plain markdown only — short paragraphs, inline code with backticks. No headings, no fenced blocks, no tables.
- For \`praise\`, say what specifically worked well so the author learns from it.
- Keep each body under ~400 characters when possible.

## Output

Respond with ONE JSON object matching the ReviewResponse schema. Begin with \`{\` and end with \`}\`. Escape newlines inside string values as \`\\n\`.`;

export const generateReviewAgentSession = async (
  requestId: string,
  request: ReviewAgentRequest,
  webContents: WebContents,
): Promise<void> => {
  const { session } = await createReviewSession();
  activeSessions.set(requestId, session);
  let failed = false;
  let result = "";

  const unsubscribe = session.subscribe((event) => {
    const streamed = streamReviewEvent(requestId, event, webContents);
    failed = streamed.failed || failed;
    result += streamed.content;
  });

  try {
    await session.prompt(formatReviewPrompt(request));
    if (!failed) {
      sendReviewEvent(requestId, webContents, { result, type: "done" });
    }
  } catch (error) {
    sendReviewEvent(requestId, webContents, {
      error: error instanceof Error ? error.message : "Review generation failed.",
      type: "error",
    });
  } finally {
    unsubscribe();
    session.dispose();
    activeSessions.delete(requestId);
  }
};

export const abortReviewAgentSession = async (requestId: string): Promise<void> => {
  const session = activeSessions.get(requestId);
  if (!session) return;
  await session.abort();
};

const createReviewSession = async (): Promise<{ session: AgentSession }> => {
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

const streamReviewEvent = (
  requestId: string,
  event: AgentSessionEvent,
  webContents: WebContents,
): { content: string; failed: boolean } => {
  if (event.type !== "message_update") return { content: "", failed: false };
  const messageEvent = event.assistantMessageEvent;

  if (messageEvent.type === "text_delta") {
    sendReviewEvent(requestId, webContents, { content: messageEvent.delta, type: "chunk" });
    return { content: messageEvent.delta, failed: false };
  }
  if (messageEvent.type === "error") {
    sendReviewEvent(requestId, webContents, {
      error: messageEvent.error.errorMessage ?? "Review generation failed.",
      type: "error",
    });
    return { content: "", failed: true };
  }
  return { content: "", failed: false };
};

const sendReviewEvent = (
  requestId: string,
  webContents: WebContents,
  event: ReviewAgentEvent,
): void => {
  if (!webContents.isDestroyed()) {
    webContents.send(`review-agent:stream:${requestId}`, event);
  }
};

const formatReviewPrompt = ({ files, metadata }: ReviewAgentRequest): string => {
  const fileSections = files.map(formatFile).join("\n\n");
  return `Review pull request ${metadata.reference}.

PR title: ${metadata.title}
Author: ${metadata.author.login}
Labels: ${metadata.labels.join(", ") || "none"}

PR description:
${metadata.body || "No PR description provided."}

Changed files:
${fileSections}

Respond with ONE JSON object matching the ReviewResponse schema. Begin with \`{\` and end with \`}\`. No prose before or after.`;
};

const formatFile = (file: ReviewAgentFile): string =>
  `### ${file.filename}
Status: ${file.status}; +${file.additions}/-${file.deletions}

\`\`\`diff
${file.patch || "No patch available."}
\`\`\``;
