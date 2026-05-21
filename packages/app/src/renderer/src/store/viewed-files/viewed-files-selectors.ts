import type { RootState } from "../store";

const viewedSelectorCache = new Map<string, (state: RootState) => string[]>();

export const selectViewedFilesForPr = (prReference: string): ((state: RootState) => string[]) => {
  let selector = viewedSelectorCache.get(prReference);
  if (!selector) {
    selector = (state: RootState) => state.viewedFiles.byReference[prReference] ?? [];
    viewedSelectorCache.set(prReference, selector);
  }
  return selector;
};

export const selectIsFileViewed =
  (prReference: string, path: string) =>
  (state: RootState): boolean =>
    (state.viewedFiles.byReference[prReference] ?? []).includes(path);
