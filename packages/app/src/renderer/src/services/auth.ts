export interface AuthStatusResult {
  authenticated: boolean;
  source: "gh" | "none" | "stored";
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
  if (typeof window === "undefined" || !window.reviewAppAuth) {
    throw new Error("GitHub authentication API is unavailable.");
  }

  return window.reviewAppAuth;
};
