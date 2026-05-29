import { contextBridge, ipcRenderer } from "electron";

type WalkthroughAgentEvent =
  | { content: string; type: "chunk" }
  | { type: "done" }
  | { error: string; type: "error" };

type OrchestratorAgentEvent =
  | { sessionId: string; type: "started" }
  | { content: string; type: "chunk" }
  | { result: string; type: "done" }
  | { error: string; type: "error" };

type ReviewAgentEvent =
  | { content: string; type: "chunk" }
  | { result: string; type: "done" }
  | { error: string; type: "error" };

type ReplyAgentEvent =
  | { content: string; type: "chunk" }
  | { result: string; type: "done" }
  | { error: string; type: "error" };

interface AuthStatusResult {
  authenticated: boolean;
  source: "gh" | "none" | "stored";
}

interface GitHubDeviceFlow {
  deviceCode: string;
  expiresIn: number;
  interval: number;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
}

interface GitHubDevicePollResult {
  interval?: number;
  status: "authenticated" | "pending" | "slow_down";
}

type RepoRegistryData = Record<string, { fullName: string; localPath: string }>;
type RepoWorktreeEntry = { branch: string; path: string };

let walkthroughRequestCount = 0;
let orchestratorRequestCount = 0;
let reviewAgentRequestCount = 0;
let replyAgentRequestCount = 0;

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
});

contextBridge.exposeInMainWorld("reviewAppAuth", {
  getGitHubToken: async (): Promise<string> => {
    const token = await ipcRenderer.invoke("auth:get-github-token");
    return typeof token === "string" ? token : "";
  },
  getStatus: async (): Promise<AuthStatusResult> => {
    const result = await ipcRenderer.invoke("auth:get-status");
    return isAuthStatusResult(result) ? result : { authenticated: false, source: "none" };
  },
  pollDeviceFlow: async (deviceCode: string): Promise<GitHubDevicePollResult> => {
    const result = await ipcRenderer.invoke("auth:poll-device-flow", deviceCode);
    return isGitHubDevicePollResult(result) ? result : { status: "pending" };
  },
  signOut: async (): Promise<void> => {
    await ipcRenderer.invoke("auth:sign-out");
  },
  startDeviceFlow: async (): Promise<GitHubDeviceFlow> => {
    const result = await ipcRenderer.invoke("auth:start-device-flow");
    if (!isGitHubDeviceFlow(result)) {
      throw new Error("GitHub sign-in returned an invalid response.");
    }

    return result;
  },
});

contextBridge.exposeInMainWorld("reviewAppRepos", {
  clone: async (fullName: string): Promise<string | null> => {
    const localPath = await ipcRenderer.invoke("repo:clone", fullName);
    return typeof localPath === "string" ? localPath : null;
  },
  diff: async (repoPath: string, baseSha: string, headSha: string): Promise<string> => {
    const result = await ipcRenderer.invoke("repo:diff", repoPath, baseSha, headSha);
    return typeof result === "string" ? result : "";
  },
  loadRegistry: async (): Promise<RepoRegistryData> => {
    const result = await ipcRenderer.invoke("repos:load-registry");
    return typeof result === "object" && result !== null ? (result as RepoRegistryData) : {};
  },
  listWorktrees: async (repoPath: string): Promise<RepoWorktreeEntry[]> => {
    const result = await ipcRenderer.invoke("repos:list-worktrees", repoPath);
    return Array.isArray(result) ? (result as RepoWorktreeEntry[]) : [];
  },
  locate: async (): Promise<string | null> => {
    const localPath = await ipcRenderer.invoke("repo:locate");
    return typeof localPath === "string" ? localPath : null;
  },
  saveRegistry: async (entries: RepoRegistryData): Promise<void> => {
    await ipcRenderer.invoke("repos:save-registry", entries);
  },
});

contextBridge.exposeInMainWorld("reviewAppWalkthrough", {
  generate: (request: unknown, onEvent: (event: WalkthroughAgentEvent) => void) => {
    const requestId = `narrative-${Date.now()}-${walkthroughRequestCount}`;
    walkthroughRequestCount += 1;
    const channel = `narrative:stream:${requestId}`;
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      if (isWalkthroughAgentEvent(payload)) {
        onEvent(payload);
      }
    };

    ipcRenderer.on(channel, listener);
    void ipcRenderer.invoke("narrative:generate", requestId, request).catch((error: unknown) => {
      onEvent({
        error: error instanceof Error ? error.message : "Walkthrough generation failed.",
        type: "error",
      });
    });

    return {
      abort: (): void => {
        ipcRenderer.removeListener(channel, listener);
        void ipcRenderer.invoke("narrative:abort", requestId);
      },
    };
  },
  save: async (prReference: string, content: string): Promise<void> => {
    await ipcRenderer.invoke("narrative:save", prReference, content);
  },
  load: async (prReference: string): Promise<string | null> => {
    const result = await ipcRenderer.invoke("narrative:load", prReference);
    return typeof result === "string" ? result : null;
  },
});

contextBridge.exposeInMainWorld("reviewAppViewedFiles", {
  load: async (prReference: string): Promise<string[]> => {
    const result = await ipcRenderer.invoke("viewed-files:load", prReference);
    return Array.isArray(result)
      ? result.filter((value): value is string => typeof value === "string")
      : [];
  },
  save: async (prReference: string, paths: string[]): Promise<void> => {
    await ipcRenderer.invoke("viewed-files:save", prReference, paths);
  },
});

contextBridge.exposeInMainWorld("reviewAppAside", {
  load: async (): Promise<string[]> => {
    const result = await ipcRenderer.invoke("aside:load");
    return Array.isArray(result)
      ? result.filter((value): value is string => typeof value === "string")
      : [];
  },
  save: async (references: string[]): Promise<void> => {
    await ipcRenderer.invoke("aside:save", references);
  },
});

contextBridge.exposeInMainWorld("reviewAppComments", {
  load: async (prReference: string): Promise<unknown[]> => {
    const result = await ipcRenderer.invoke("comments:load", prReference);
    return Array.isArray(result) ? result : [];
  },
  save: async (prReference: string, threads: unknown[]): Promise<void> => {
    await ipcRenderer.invoke("comments:save", prReference, threads);
  },
});

contextBridge.exposeInMainWorld("reviewAppReviewAgent", {
  run: (request: unknown, onEvent: (event: ReviewAgentEvent) => void) => {
    const requestId = `review-agent-${Date.now()}-${reviewAgentRequestCount}`;
    reviewAgentRequestCount += 1;
    const channel = `review-agent:stream:${requestId}`;
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      if (isReviewAgentEvent(payload)) {
        onEvent(payload);
      }
    };

    ipcRenderer.on(channel, listener);
    void ipcRenderer.invoke("review-agent:run", requestId, request).catch((error: unknown) => {
      onEvent({
        error: error instanceof Error ? error.message : "Review agent session failed.",
        type: "error",
      });
    });

    return {
      abort: (): void => {
        ipcRenderer.removeListener(channel, listener);
        void ipcRenderer.invoke("review-agent:abort", requestId);
      },
    };
  },
});

contextBridge.exposeInMainWorld("reviewAppReplyAgent", {
  run: (request: unknown, onEvent: (event: ReplyAgentEvent) => void) => {
    const requestId = `reply-agent-${Date.now()}-${replyAgentRequestCount}`;
    replyAgentRequestCount += 1;
    const channel = `reply-agent:stream:${requestId}`;
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      if (isReplyAgentEvent(payload)) {
        onEvent(payload);
      }
    };

    ipcRenderer.on(channel, listener);
    void ipcRenderer.invoke("reply-agent:run", requestId, request).catch((error: unknown) => {
      onEvent({
        error: error instanceof Error ? error.message : "Reply agent session failed.",
        type: "error",
      });
    });

    return {
      abort: (): void => {
        ipcRenderer.removeListener(channel, listener);
        void ipcRenderer.invoke("reply-agent:abort", requestId);
      },
    };
  },
});

contextBridge.exposeInMainWorld("reviewAppOrchestrator", {
  run: (request: unknown, onEvent: (event: OrchestratorAgentEvent) => void) => {
    const requestId = `orchestrator-${Date.now()}-${orchestratorRequestCount}`;
    orchestratorRequestCount += 1;
    const channel = `orchestrator:stream:${requestId}`;
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      if (isOrchestratorAgentEvent(payload)) {
        onEvent(payload);
      }
    };

    ipcRenderer.on(channel, listener);
    void ipcRenderer.invoke("orchestrator:run", requestId, request).catch((error: unknown) => {
      onEvent({
        error: error instanceof Error ? error.message : "Orchestrator agent session failed.",
        type: "error",
      });
    });

    return {
      abort: (): void => {
        ipcRenderer.removeListener(channel, listener);
        void ipcRenderer.invoke("orchestrator:abort", requestId);
      },
    };
  },
});

const isWalkthroughAgentEvent = (payload: unknown): payload is WalkthroughAgentEvent => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const event = payload as { content?: unknown; error?: unknown; type?: unknown };
  return (
    (event.type === "chunk" && typeof event.content === "string") ||
    event.type === "done" ||
    (event.type === "error" && typeof event.error === "string")
  );
};

const isReviewAgentEvent = (payload: unknown): payload is ReviewAgentEvent => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const event = payload as { content?: unknown; error?: unknown; result?: unknown; type?: unknown };
  return (
    (event.type === "chunk" && typeof event.content === "string") ||
    (event.type === "done" && typeof event.result === "string") ||
    (event.type === "error" && typeof event.error === "string")
  );
};

const isReplyAgentEvent = (payload: unknown): payload is ReplyAgentEvent => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const event = payload as { content?: unknown; error?: unknown; result?: unknown; type?: unknown };
  return (
    (event.type === "chunk" && typeof event.content === "string") ||
    (event.type === "done" && typeof event.result === "string") ||
    (event.type === "error" && typeof event.error === "string")
  );
};

const isOrchestratorAgentEvent = (payload: unknown): payload is OrchestratorAgentEvent => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const event = payload as {
    content?: unknown;
    error?: unknown;
    result?: unknown;
    sessionId?: unknown;
    type?: unknown;
  };
  return (
    (event.type === "started" && typeof event.sessionId === "string") ||
    (event.type === "chunk" && typeof event.content === "string") ||
    (event.type === "done" && typeof event.result === "string") ||
    (event.type === "error" && typeof event.error === "string")
  );
};

const isAuthStatusResult = (payload: unknown): payload is AuthStatusResult => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const result = payload as { authenticated?: unknown; source?: unknown };
  return (
    typeof result.authenticated === "boolean" &&
    (result.source === "gh" || result.source === "none" || result.source === "stored")
  );
};

const isGitHubDeviceFlow = (payload: unknown): payload is GitHubDeviceFlow => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const result = payload as {
    deviceCode?: unknown;
    expiresIn?: unknown;
    interval?: unknown;
    userCode?: unknown;
    verificationUri?: unknown;
    verificationUriComplete?: unknown;
  };
  return (
    typeof result.deviceCode === "string" &&
    typeof result.expiresIn === "number" &&
    typeof result.interval === "number" &&
    typeof result.userCode === "string" &&
    typeof result.verificationUri === "string" &&
    (result.verificationUriComplete === undefined ||
      typeof result.verificationUriComplete === "string")
  );
};

const isGitHubDevicePollResult = (payload: unknown): payload is GitHubDevicePollResult => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const result = payload as { interval?: unknown; status?: unknown };
  return (
    (result.status === "authenticated" ||
      result.status === "pending" ||
      result.status === "slow_down") &&
    (result.interval === undefined || typeof result.interval === "number")
  );
};
