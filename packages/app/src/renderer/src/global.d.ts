export {};

import type {
  OrchestratorAgentController,
  OrchestratorAgentEvent,
  OrchestratorAgentSessionRequest,
} from "./services/agent-orchestrator";
import type { AuthStatusResult, GitHubDeviceFlow, GitHubDevicePollResult } from "./services/auth";
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
    reviewAppAuth: {
      getGitHubToken: () => Promise<string>;
      getStatus: () => Promise<AuthStatusResult>;
      pollDeviceFlow: (deviceCode: string) => Promise<GitHubDevicePollResult>;
      signOut: () => Promise<void>;
      startDeviceFlow: () => Promise<GitHubDeviceFlow>;
    };
    reviewAppRepos: {
      clone: (fullName: string) => Promise<string | null>;
      locate: () => Promise<string | null>;
    };
    reviewAppNarrative: {
      generate: (
        request: NarrativeAgentRequest,
        onEvent: (event: NarrativeAgentEvent) => void,
      ) => NarrativeAgentController;
    };
    reviewAppOrchestrator: {
      run: (
        request: OrchestratorAgentSessionRequest,
        onEvent: (event: OrchestratorAgentEvent) => void,
      ) => OrchestratorAgentController;
    };
  }
}
