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
      loadRegistry: () => Promise<Record<string, { fullName: string; localPath: string }>>;
      listWorktrees: (repoPath: string) => Promise<Array<{ branch: string; path: string }>>;
      locate: () => Promise<string | null>;
      saveRegistry: (
        entries: Record<string, { fullName: string; localPath: string }>,
      ) => Promise<void>;
    };
    reviewAppNarrative: {
      generate: (
        request: NarrativeAgentRequest,
        onEvent: (event: NarrativeAgentEvent) => void,
      ) => NarrativeAgentController;
      save: (prReference: string, content: string) => Promise<void>;
      load: (prReference: string) => Promise<string | null>;
    };
    reviewAppOrchestrator: {
      run: (
        request: OrchestratorAgentSessionRequest,
        onEvent: (event: OrchestratorAgentEvent) => void,
      ) => OrchestratorAgentController;
    };
  }
}
