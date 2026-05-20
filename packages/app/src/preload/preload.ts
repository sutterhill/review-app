import { contextBridge, ipcRenderer } from "electron";

type NarrativeAgentEvent =
  | { content: string; type: "chunk" }
  | { type: "done" }
  | { error: string; type: "error" };

let narrativeRequestCount = 0;

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
});

contextBridge.exposeInMainWorld("reviewAppSettings", {
  getGitHubToken: async (): Promise<string> => {
    const token = await ipcRenderer.invoke("settings:get-github-token");
    return typeof token === "string" ? token : "";
  },
  setGitHubToken: async (token: string): Promise<void> => {
    await ipcRenderer.invoke("settings:set-github-token", token);
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
