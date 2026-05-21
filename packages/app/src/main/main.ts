import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { app, BrowserWindow, dialog, ipcMain, safeStorage } from "electron";

import { abortNarrativeAgentSession, generateNarrativeAgentSession } from "./narrative-agent";
import { abortOrchestratorAgentSession, runOrchestratorAgentSession } from "./orchestrator-agent";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

const execFileAsync = promisify(execFile);
const GITHUB_REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_OAUTH_CLIENT_ID_ENV = "GITHUB_OAUTH_CLIENT_ID";
const GITHUB_OAUTH_SCOPE = "repo read:org";
const GITHUB_TOKEN_FILE = "github-oauth-token";

interface AuthStatusResponse {
  authenticated: boolean;
  source: "gh" | "none" | "stored";
}

interface DeviceFlowResponse {
  deviceCode: string;
  expiresIn: number;
  interval: number;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
}

interface DeviceTokenPollResponse {
  interval?: number;
  status: "authenticated" | "pending" | "slow_down";
}

ipcMain.handle("auth:get-status", async (): Promise<AuthStatusResponse> => getAuthStatus());

ipcMain.handle("auth:get-github-token", async (): Promise<string> => getOAuthToken());

ipcMain.handle(
  "auth:start-device-flow",
  async (): Promise<DeviceFlowResponse> => startDeviceFlow(),
);

ipcMain.handle("auth:poll-device-flow", async (_event, deviceCode: unknown) => {
  if (typeof deviceCode !== "string" || deviceCode.trim().length === 0) {
    throw new Error("GitHub device code is required.");
  }

  return pollDeviceFlow(deviceCode);
});

ipcMain.handle("auth:sign-out", async (): Promise<void> => {
  await clearOAuthToken();
});

ipcMain.handle("repo:clone", async (_event, fullName: unknown) => {
  const repository = validateRepositoryFullName(fullName);
  const parentDirectory = await chooseDirectory("Choose where to clone the repository");

  if (!parentDirectory) {
    return null;
  }

  await execFileAsync("gh", ["repo", "clone", repository], { cwd: parentDirectory });
  return path.join(parentDirectory, getRepositoryDirectoryName(repository));
});

ipcMain.handle("repo:locate", async () => chooseDirectory("Select a local repository checkout"));

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

ipcMain.handle("orchestrator:run", async (event, requestId: unknown, request: unknown) => {
  if (typeof requestId !== "string" || !isOrchestratorSessionRequest(request)) {
    throw new Error("Invalid orchestrator session request.");
  }

  await runOrchestratorAgentSession(requestId, request, event.sender);
});

ipcMain.handle("orchestrator:abort", async (_event, requestId: unknown) => {
  if (typeof requestId === "string") {
    await abortOrchestratorAgentSession(requestId);
  }
});

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    height: 768,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
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

const isOrchestratorSessionRequest = (
  request: unknown,
): request is Parameters<typeof runOrchestratorAgentSession>[1] => {
  if (!request || typeof request !== "object") {
    return false;
  }

  const candidate = request as { cwd?: unknown; prompt?: unknown; tools?: unknown };
  return (
    typeof candidate.cwd === "string" &&
    candidate.cwd.length > 0 &&
    typeof candidate.prompt === "string" &&
    candidate.prompt.length > 0 &&
    (candidate.tools === undefined ||
      (Array.isArray(candidate.tools) && candidate.tools.every((tool) => typeof tool === "string")))
  );
};

const getAuthStatus = async (): Promise<AuthStatusResponse> => {
  if ((await readStoredOAuthToken()).length > 0) {
    return { authenticated: true, source: "stored" };
  }

  const ghToken = await readGhCliToken();
  if (ghToken.length > 0) {
    await writeOAuthToken(ghToken).catch(() => undefined);
    return { authenticated: true, source: "gh" };
  }

  return { authenticated: false, source: "none" };
};

const getOAuthToken = async (): Promise<string> => {
  const storedToken = await readStoredOAuthToken();
  if (storedToken.length > 0) {
    return storedToken;
  }

  const ghToken = await readGhCliToken();
  if (ghToken.length > 0) {
    await writeOAuthToken(ghToken).catch(() => undefined);
  }

  return ghToken;
};

const startDeviceFlow = async (): Promise<DeviceFlowResponse> => {
  const response = await postGitHubForm(GITHUB_DEVICE_CODE_URL, {
    client_id: getGitHubOAuthClientId(),
    scope: GITHUB_OAUTH_SCOPE,
  });

  return {
    deviceCode: readRequiredString(response, "device_code"),
    expiresIn: readRequiredNumber(response, "expires_in"),
    interval: readRequiredNumber(response, "interval"),
    userCode: readRequiredString(response, "user_code"),
    verificationUri: readRequiredString(response, "verification_uri"),
    verificationUriComplete: readOptionalString(response, "verification_uri_complete"),
  };
};

const pollDeviceFlow = async (deviceCode: string): Promise<DeviceTokenPollResponse> => {
  const response = await postGitHubForm(GITHUB_ACCESS_TOKEN_URL, {
    client_id: getGitHubOAuthClientId(),
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });

  const accessToken = readOptionalString(response, "access_token");
  if (accessToken) {
    await writeOAuthToken(accessToken);
    return { status: "authenticated" };
  }

  const error = readOptionalString(response, "error");
  if (error === "authorization_pending") {
    return { status: "pending" };
  }

  if (error === "slow_down") {
    return { interval: 5, status: "slow_down" };
  }

  if (error === "expired_token") {
    throw new Error("GitHub device code expired. Start sign-in again.");
  }

  if (error === "access_denied") {
    throw new Error("GitHub sign-in was denied.");
  }

  throw new Error(readOptionalString(response, "error_description") ?? "GitHub sign-in failed.");
};

const readGhCliToken = async (): Promise<string> => {
  try {
    await execFileAsync("gh", ["auth", "status", "--hostname", "github.com"], { timeout: 5000 });
    const { stdout } = await execFileAsync("gh", ["auth", "token", "--hostname", "github.com"], {
      timeout: 5000,
    });
    return stdout.trim();
  } catch {
    return "";
  }
};

const readStoredOAuthToken = async (): Promise<string> => {
  if (!safeStorage.isEncryptionAvailable()) {
    return "";
  }

  try {
    const encryptedToken = await fs.readFile(getOAuthTokenPath());
    return safeStorage.decryptString(encryptedToken).trim();
  } catch {
    return "";
  }
};

const writeOAuthToken = async (token: string): Promise<void> => {
  const normalizedToken = token.trim();
  if (normalizedToken.length === 0) {
    await clearOAuthToken();
    return;
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Electron safeStorage is unavailable for GitHub token storage.");
  }

  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(getOAuthTokenPath(), safeStorage.encryptString(normalizedToken));
};

const clearOAuthToken = async (): Promise<void> => {
  await fs.rm(getOAuthTokenPath(), { force: true });
};

const getOAuthTokenPath = (): string => path.join(app.getPath("userData"), GITHUB_TOKEN_FILE);

const getGitHubOAuthClientId = (): string => {
  const clientId = process.env[GITHUB_OAUTH_CLIENT_ID_ENV]?.trim();
  if (!clientId) {
    throw new Error(`${GITHUB_OAUTH_CLIENT_ID_ENV} must be configured to use GitHub sign-in.`);
  }

  return clientId;
};

const postGitHubForm = async (
  url: string,
  body: Record<string, string>,
): Promise<Record<string, unknown>> => {
  const response = await fetch(url, {
    body: new URLSearchParams(body),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  const json = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error("GitHub authentication request failed.");
  }

  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("GitHub authentication returned an invalid response.");
  }

  return json as Record<string, unknown>;
};

const readRequiredString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`GitHub authentication response is missing ${key}.`);
  }

  return value;
};

const readOptionalString = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const readRequiredNumber = (record: Record<string, unknown>, key: string): number => {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`GitHub authentication response is missing ${key}.`);
  }

  return value;
};

const chooseDirectory = async (title: string): Promise<string | null> => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
    title,
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0] ?? null;
};

const validateRepositoryFullName = (fullName: unknown): string => {
  if (typeof fullName !== "string" || !GITHUB_REPOSITORY_PATTERN.test(fullName)) {
    throw new Error("Repository must use owner/repo format.");
  }

  return fullName;
};

const getRepositoryDirectoryName = (fullName: string): string => fullName.split("/")[1] ?? fullName;
