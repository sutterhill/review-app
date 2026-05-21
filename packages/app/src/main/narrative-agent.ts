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

const SYSTEM_PROMPT = `You produce a structured walkthrough that helps a human review a pull request. Write it like a feature story in The New York Times or The Pudding — clear, scannable, opinionated about what matters, and grounded in the actual code. You output exactly one JSON object — no prose before or after, no markdown fences, no explanation.

## Output schema

\`\`\`ts
interface WalkthroughResponse {
  description: string;             // one or two plain sentences summarizing the PR
  groups: Array<{                  // 2-5 semantic groupings of changed files
    title: string;                 // short descriptive title (not file path)
    filePaths: string[];           // file paths in this group
  }>;
  steps: Array<{                   // 3-8 narrative steps, in walkthrough order
    heading: string;               // an action-oriented sentence; see "Headings" below
    body: string;                  // markdown body; see "Body" below
    relevantFiles: Array<{
      path: string;                // file path
      lineRanges?: Array<[number, number]>; // 1-indexed inclusive ranges in NEW file
    }>;
  }>;
  suggestedQuestions: string[];    // 2-4 short follow-up prompts a reviewer might ask
}
\`\`\`

## Headings

Make each \`heading\` immediately understandable on its own — a reviewer skimming the left column should know exactly what the step accomplishes. Use plain English, an active verb, and the concrete object of the change. Aim for 4–9 words.

- Good: "Add new API endpoint for settings page"
- Good: "Replace polling with WebSocket updates in the inbox"
- Good: "Migrate auth tokens from cookies to the system keychain"
- Bad: "Changes to api.ts" (names a file, not the change)
- Bad: "Refactoring" (no object)
- Bad: "Various improvements" (no verb-object)

## Body

Write the body in lightly-formatted markdown — short paragraphs interleaved with the structural elements below when they genuinely help comprehension. Lead each step with the *why* (what problem this solves, what changed in behavior), then walk through the *how*, then call out anything risky or surprising.

You may use:

- **Bulleted lists** for enumerating handlers, fields, edge cases, or anything parallel.
- **Numbered lists** for ordered procedures (request flow, migration steps).
- **Tables** when comparing before/after, listing config keys with descriptions, or mapping routes to handlers. Use standard GitHub-flavored markdown tables.
- **Mermaid diagrams** in fenced \`\`\`mermaid blocks when a sequence, state machine, or component graph is faster to grasp than prose. Keep them small (≤ ~8 nodes). Use them sparingly — only when they earn their space.
- **Inline code** with backticks for symbol names, file names, config keys, and short snippets.

Reference the codebase generously with the inline syntax \`{{ref:path/to/file.ts#L10-20}}\` for line ranges, or \`{{ref:path/to/file.ts}}\` for a whole file. These render as clickable chips that open the file. Link to specific functions, classes, or hooks at their definition lines rather than to whole files when you can. Aim for at least one ref per paragraph that discusses code.

Give context the diff alone doesn't carry: the user-visible behavior change, the constraint that drove the design, the alternative that was rejected, the follow-up the author punted on. When a piece of code is load-bearing or non-obvious, say so plainly.

## File coverage

The walkthrough is the reviewer's map of the PR — every changed file should land somewhere they can find it. Be aggressive about attaching files to steps:

- Aim to attach **every changed file** to the \`relevantFiles\` of at least one step. Treat full coverage as the default goal and only omit a file when it is truly noise (lockfiles, generated artifacts, pure formatting, snapshot updates, import-only churn).
- When a step's primary subject is one or two files, still list any supporting files that changed for the same reason (callers updated to match a new signature, tests for the new behavior, types/fixtures, config knobs, docs). Mention them by name in the body with a \`{{ref:…}}\` chip so the reviewer knows why they're attached.
- If several small files only exist to support one step (e.g. a handful of caller updates, a couple of new tests), attach them all to that step rather than spinning up a thin step per file. A step can comfortably reference 5–15 files when they share a story.
- If a cluster of files genuinely doesn't fit any narrative step (small bumps, peripheral cleanup, config tweaks), end with a short "Smaller adjustments" or "Cleanup" step whose \`relevantFiles\` sweeps them up with a one-line note for each.
- Before finalizing, mentally diff the union of \`steps[].relevantFiles[].path\` against the input file list — anything missing should either be added to a step or consciously skipped as noise.

## Rules

- Output only valid JSON. Begin the response with \`{\` and end with \`}\`. Escape newlines inside string values as \`\\n\`.
- Every file in \`groups[].filePaths\` must appear at most once across all groups.
- Cover every meaningful file path from the input across the groups, ignoring lockfiles, generated artifacts, pure formatting, and import-only changes.
- Each step's \`relevantFiles\` should list the files (and ideally line ranges) most relevant to that step. Anything you \`{{ref:…}}\` in the body should also appear in \`relevantFiles\`.
- Use plain prose in \`description\` and \`heading\` (no markdown). Body is the only place for lists, tables, and diagrams.
- Group related changes into one step when they tell one story; do not march file-by-file.
- Keep \`description\` to 1–2 sentences. Do not exceed ~8 steps.

## Follow-up turns

When the user asks a follow-up question, return the same schema. You may set \`groups\` to an empty array and reuse \`steps\` to answer the question. The heading of the first step should restate the question as an action ("Trace how the new endpoint authenticates the user"). \`suggestedQuestions\` should propose further drill-ins.`;

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
