import path from "node:path";

import { app, BrowserWindow, ipcMain } from "electron";
import Store from "electron-store";

import { abortNarrativeAgentSession, generateNarrativeAgentSession } from "./narrative-agent";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

interface SettingsSchema {
  githubToken?: string;
}

const settingsStore = new Store<SettingsSchema>({ name: "settings" });

ipcMain.handle("settings:get-github-token", () => settingsStore.get("githubToken", ""));

ipcMain.handle("settings:set-github-token", (_event, token: unknown) => {
  if (typeof token !== "string") {
    throw new Error("GitHub token must be a string");
  }

  const normalizedToken = token.trim();

  if (normalizedToken.length === 0) {
    settingsStore.delete("githubToken");
    return true;
  }

  settingsStore.set("githubToken", normalizedToken);
  return true;
});

ipcMain.handle("narrative:generate", async (event, requestId: unknown, request: unknown) => {
  if (typeof requestId !== "string" || !isNarrativeRequest(request)) {
    throw new Error("Invalid narrative generation request.");
  }

  await generateNarrativeAgentSession(requestId, request, event.sender);
});

ipcMain.handle("narrative:abort", async (_event, requestId: unknown) => {
  if (typeof requestId === "string") {
    await abortNarrativeAgentSession(requestId);
  }
});

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    height: 768,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "../preload/preload.js"),
    },
    width: 1024,
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    return;
  }

  void mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
};

void app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

const isNarrativeRequest = (
  request: unknown,
): request is Parameters<typeof generateNarrativeAgentSession>[1] => {
  if (!request || typeof request !== "object") {
    return false;
  }

  const candidate = request as { groups?: unknown; metadata?: unknown };
  return Array.isArray(candidate.groups) && !!candidate.metadata;
};
