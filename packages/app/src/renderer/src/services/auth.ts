export interface AuthStatusResult {
  authenticated: boolean;
  source: "gh" | "none" | "oauth" | "stored";
}

export interface GitHubDeviceFlow {
  deviceCode: string;
  expiresIn: number;
  interval: number;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
}

export interface GitHubDevicePollResult {
  interval?: number;
  status: "authenticated" | "pending" | "slow_down";
}

const WEB_OAUTH_SESSION_KEY = "review-app.oauth-session";
const WEB_OAUTH_SESSION_QUERY_PARAM = "reviewAppSession";

export const getAuthStatus = async (): Promise<AuthStatusResult> => getAuthApi().getStatus();

export const getGitHubToken = async (): Promise<string> => getAuthApi().getGitHubToken();

export const startGitHubDeviceFlow = async (): Promise<GitHubDeviceFlow> =>
  getAuthApi().startDeviceFlow();

export const pollGitHubDeviceFlow = async (deviceCode: string): Promise<GitHubDevicePollResult> =>
  getAuthApi().pollDeviceFlow(deviceCode);

export const signOutGitHub = async (): Promise<void> => {
  await getAuthApi().signOut();
};

const getAuthApi = (): Window["reviewAppAuth"] => {
  if (typeof window === "undefined") {
    throw new Error("GitHub authentication API is unavailable.");
  }

  if (window.reviewAppAuth) {
    return window.reviewAppAuth;
  }

  return browserAuthApi;
};

const browserAuthApi: Window["reviewAppAuth"] = {
  getGitHubToken: async (): Promise<string> => {
    const session = getStoredOAuthSession();
    if (!session) return "";

    const result = await fetchOAuthSession(session);
    return result.githubToken;
  },
  getStatus: async (): Promise<AuthStatusResult> => {
    captureOAuthSessionFromUrl();
    const session = getStoredOAuthSession();
    if (!session) return { authenticated: false, source: "none" };

    try {
      await fetchOAuthSession(session);
      return { authenticated: true, source: "oauth" };
    } catch {
      window.localStorage.removeItem(WEB_OAUTH_SESSION_KEY);
      return { authenticated: false, source: "none" };
    }
  },
  pollDeviceFlow: async (): Promise<GitHubDevicePollResult> => ({
    status: getStoredOAuthSession() ? "authenticated" : "pending",
  }),
  signOut: async (): Promise<void> => {
    window.localStorage.removeItem(WEB_OAUTH_SESSION_KEY);
  },
  startDeviceFlow: async (): Promise<GitHubDeviceFlow> => {
    const apiUrl = getWebApiUrl();
    const returnTo = `${window.location.origin}${window.location.pathname}`;
    window.location.assign(`${apiUrl}/auth/github/start?return_to=${encodeURIComponent(returnTo)}`);

    return {
      deviceCode: "",
      expiresIn: 600,
      interval: 5,
      userCode: "",
      verificationUri: "https://github.com/login/oauth/authorize",
    };
  },
};

const getStoredOAuthSession = (): string =>
  typeof window === "undefined" ? "" : (window.localStorage.getItem(WEB_OAUTH_SESSION_KEY) ?? "");

const captureOAuthSessionFromUrl = (): void => {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const session = url.searchParams.get(WEB_OAUTH_SESSION_QUERY_PARAM);
  if (!session) return;

  window.localStorage.setItem(WEB_OAUTH_SESSION_KEY, session);
  url.searchParams.delete(WEB_OAUTH_SESSION_QUERY_PARAM);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
};

const fetchOAuthSession = async (session: string): Promise<{ githubToken: string }> => {
  const response = await fetch(`${getWebApiUrl()}/auth/session`, {
    headers: { Authorization: `Bearer ${session}` },
  });

  if (!response.ok) {
    throw new Error("GitHub OAuth session is unavailable.");
  }

  const body = (await response.json()) as { githubToken?: unknown };
  if (typeof body.githubToken !== "string" || body.githubToken.length === 0) {
    throw new Error("GitHub OAuth session did not include a token.");
  }

  return { githubToken: body.githubToken };
};

const getWebApiUrl = (): string => {
  const url = import.meta.env.VITE_REVIEW_APP_API_URL ?? "http://localhost:8787";
  if (typeof url !== "string" || url.trim().length === 0) {
    throw new Error("VITE_REVIEW_APP_API_URL is required for web GitHub OAuth.");
  }

  return url.trim().replace(/\/$/u, "");
};
