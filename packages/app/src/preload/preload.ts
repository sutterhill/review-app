import { contextBridge, ipcRenderer } from "electron";

type NarrativeAgentEvent =
  | { content: string; type: "chunk" }
  | { type: "done" }
  | { error: string; type: "error" };

type OrchestratorAgentEvent =
  | { sessionId: string; type: "started" }
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

let narrativeRequestCount = 0;
let orchestratorRequestCount = 0;

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
  locate: async (): Promise<string | null> => {
    const localPath = await ipcRenderer.invoke("repo:locate");
    return typeof localPath === "string" ? localPath : null;
  },
});

contextBridge.exposeInMainWorld("reviewAppNarrative", {
  generate: (request: unknown, onEvent: (event: NarrativeAgentEvent) => void) => {
    const requestId = `narrative-${Date.now()}-${narrativeRequestCount}`;
    narrativeRequestCount += 1;
    const channel = `narrative:stream:${requestId}`;
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      if (isNarrativeAgentEvent(payload)) {
        onEvent(payload);
      }
    };

    ipcRenderer.on(channel, listener);
    void ipcRenderer.invoke("narrative:generate", requestId, request).catch((error: unknown) => {
      onEvent({
        error: error instanceof Error ? error.message : "Narrative generation failed.",
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

const isNarrativeAgentEvent = (payload: unknown): payload is NarrativeAgentEvent => {
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
