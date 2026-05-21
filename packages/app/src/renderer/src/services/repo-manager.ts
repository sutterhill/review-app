export const cloneRepository = async (fullName: string): Promise<string | null> => {
  if (typeof window === "undefined" || !window.reviewAppRepos) {
    throw new Error("Repository manager API is unavailable.");
  }

  return window.reviewAppRepos.clone(fullName);
};

export const locateRepository = async (): Promise<string | null> => {
  if (typeof window === "undefined" || !window.reviewAppRepos) {
    throw new Error("Repository manager API is unavailable.");
  }

  return window.reviewAppRepos.locate();
};

export const generateLocalDiff = async (
  repoPath: string,
  baseSha: string,
  headSha: string,
): Promise<string> => {
  if (typeof window === "undefined" || !window.reviewAppRepos) {
    throw new Error("Repository manager API is unavailable.");
  }

  return window.reviewAppRepos.diff(repoPath, baseSha, headSha);
};
