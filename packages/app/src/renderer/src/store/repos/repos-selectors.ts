import type { RootState } from "../store";
import { normalizeRepoKey } from "./repos-slice";
import type { RepoRegistryEntry } from "./repos-types";

export const selectRepoEntries = (state: RootState): Record<string, RepoRegistryEntry> =>
  state.repos.entries;

export const selectRepoEntry = (
  state: RootState,
  fullName: string,
): RepoRegistryEntry | undefined => state.repos.entries[normalizeRepoKey(fullName)];
