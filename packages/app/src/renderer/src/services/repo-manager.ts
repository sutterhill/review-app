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
