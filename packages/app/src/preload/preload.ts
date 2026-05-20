import { contextBridge, ipcRenderer } from "electron";

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
