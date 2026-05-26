export const cloneRepository = async (fullName: string): Promise<string | null> => {
  if (typeof window === "undefined" || !window.reviewAppRepos) {
    return null;
  }

  return window.reviewAppRepos.clone(fullName);
};

export const locateRepository = async (): Promise<string | null> => {
  if (typeof window === "undefined" || !window.reviewAppRepos) {
    return null;
  }

  return window.reviewAppRepos.locate();
};

export const generateLocalDiff = async (
  repoPath: string,
  baseSha: string,
  headSha: string,
): Promise<string> => {
  if (typeof window === "undefined" || !window.reviewAppRepos) {
    throw new Error("Local git diffs are only available in the desktop app.");
  }

  return window.reviewAppRepos.diff(repoPath, baseSha, headSha);
};
