export {};

declare global {
  interface Window {
    electronAPI: {
      platform: NodeJS.Platform;
    };
    reviewAppSettings: {
      getGitHubToken: () => Promise<string>;
      setGitHubToken: (token: string) => Promise<void>;
    };
  }
}
