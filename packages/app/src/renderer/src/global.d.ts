export {};

import type {
  NarrativeAgentController,
  NarrativeAgentEvent,
  NarrativeAgentRequest,
} from "./services/narrative-agent";

declare global {
  interface Window {
    electronAPI: {
      platform: NodeJS.Platform;
    };
    reviewAppSettings: {
      getGitHubToken: () => Promise<string>;
      setGitHubToken: (token: string) => Promise<void>;
    };
    reviewAppNarrative: {
      generate: (
        request: NarrativeAgentRequest,
        onEvent: (event: NarrativeAgentEvent) => void,
      ) => NarrativeAgentController;
    };
  }
}
