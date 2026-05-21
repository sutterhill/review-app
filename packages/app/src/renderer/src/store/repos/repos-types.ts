export type RepoCheckoutStatus = "cloning" | "failed" | "idle" | "locating" | "ready";

export interface RepoRegistryEntry {
  error: string | null;
  fullName: string;
  localPath: string | null;
  status: RepoCheckoutStatus;
  worktrees: RepoWorktreeEntry[] | null;
}

export interface RepoWorktreeEntry {
  branch: string;
  path: string;
}

export interface ReposState {
  entries: Record<string, RepoRegistryEntry>;
}

export type SavedRepoRegistry = Record<string, { fullName: string; localPath: string }>;

export interface RepoCheckoutRequest {
  fullName: string;
}

export interface RepoCheckoutResult {
  fullName: string;
  localPath: string;
}

export interface RepoCheckoutFailure {
  error: string;
  fullName: string;
}
