export const getGitHubToken = async (): Promise<string> => {
  if (typeof window === "undefined" || !window.reviewAppSettings) {
    return "";
  }

  return window.reviewAppSettings.getGitHubToken();
};

export const setGitHubToken = async (token: string): Promise<void> => {
  if (typeof window === "undefined" || !window.reviewAppSettings) {
    throw new Error("Settings API is unavailable");
  }

  await window.reviewAppSettings.setGitHubToken(token);
};
