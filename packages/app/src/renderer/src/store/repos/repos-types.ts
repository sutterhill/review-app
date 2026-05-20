export type RepoCheckoutStatus = "cloning" | "failed" | "idle" | "locating" | "ready";

export interface RepoRegistryEntry {
  error: string | null;
  fullName: string;
  localPath: string | null;
  status: RepoCheckoutStatus;
}

export interface ReposState {
  entries: Record<string, RepoRegistryEntry>;
}

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
