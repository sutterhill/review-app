export {};

import type {
  OrchestratorAgentController,
  OrchestratorAgentEvent,
  OrchestratorAgentSessionRequest,
} from "./services/agent-orchestrator";
import type { AuthStatusResult, GitHubDeviceFlow, GitHubDevicePollResult } from "./services/auth";
import type {
  WalkthroughAgentController,
  WalkthroughAgentEvent,
  WalkthroughAgentRequest,
} from "./services/walkthrough-agent";

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
      diff: (repoPath: string, baseSha: string, headSha: string) => Promise<string>;
      loadRegistry: () => Promise<Record<string, { fullName: string; localPath: string }>>;
      listWorktrees: (repoPath: string) => Promise<Array<{ branch: string; path: string }>>;
      locate: () => Promise<string | null>;
      saveRegistry: (
        entries: Record<string, { fullName: string; localPath: string }>,
      ) => Promise<void>;
    };
    reviewAppWalkthrough: {
      generate: (
        request: WalkthroughAgentRequest,
        onEvent: (event: WalkthroughAgentEvent) => void,
      ) => WalkthroughAgentController;
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
