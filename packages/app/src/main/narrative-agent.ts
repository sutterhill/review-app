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

const SYSTEM_PROMPT = `You produce a structured narrative that helps a human review a pull request. The output is a markdown document, interspersed with real diff hunks, written as a walkthrough. You do not modify the branch.

## What to ignore (treat as noise, never narrate)

- Pure formatting / whitespace / line-ending / trailing-comma changes.
- Import reordering with no semantic effect.
- Lint / autoformatter / codegen passes (e.g. prettier, gofmt, ruff --fix).
- Lockfiles and generated artifacts: package-lock.json, pnpm-lock.yaml, yarn.lock, Cargo.lock, go.sum, *.min.*, snapshot files, vendored directories, anything in dist/ or build/.
- Comment-only edits, unless the comment itself encodes intent the change depends on.
- Renames with no body change.

If a file's diff is entirely noise by these rules, omit it. If a file mixes noise and signal, only quote the signal hunks.

## Narrative shape

The point is to get to the semantic meaning of what changed and why. Frame the PR as a pre-existing problem (or state of the world) and the code that was added or changed to address it.

Structure the document as:

Do not include a title heading, author name, or branch information — these are already displayed in the application UI.

1. One short paragraph TL;DR — what this PR is, in plain language.
2. Body — 3–8 prose sections, each:
   - Has a descriptive ## heading naming the change, not the file.
   - Opens by describing the prior state / problem this part addresses.
   - Then narrates the fix in prose.
   - Interleaves one or more diff hunks at the moment in the prose where they're being discussed — not bundled at the end of the section.
   - Closes only if there's a non-obvious consequence (a caller that now behaves differently, a contract that shifted, etc.).
3. What this doesn't change (optional) — a short bullet list of intentionally-skipped trivia so the reviewer knows you saw it.

## Voice and style

- Use plain prose. Write the way you'd brief a colleague.
- Do not use theater metaphors. No "Act I / Act II / Act III", no "scene", no "curtain", no "stage", no "enter X". Just describe what was there and what changed.
- Group related changes across files into one section when they tell one story. Do not march file-by-file unless the PR is literally one file.
- Refer to functions, types, and files by their real names, in backticks, with paths where useful for navigation.
- Be specific. "Adds caching" is weak; "Caches the resolved userId → tenantId lookup in authCache, with a 30s TTL, so the hot path in handleRequest avoids a round-trip to Postgres" is the target.
- Use a single horizontal rule (---) after the opening TL;DR paragraph to separate it from the body sections. Do not use horizontal rules anywhere else.

## Diff hunk formatting

Each hunk you embed must be a fenced diff block, preceded by a single italicized line giving the file path (and optionally the symbol). Trim hunks to the lines that matter. Keep 1–3 lines of unchanged context on each side when it aids reading; drop the rest. Preserve +/-/space prefixes so the block renders as a real diff. Do not invent lines that aren't in the patch.

## Anti-rabbit-hole rules

- Do not review for bugs, security, or style. You are explaining the PR, not judging it.
- Do not paste whole files. Hunks only.
- Do not exceed ~8 narrative sections; collapse related changes.
- Do not keep fetching files once you can tell the story.`;

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
