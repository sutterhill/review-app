import type { RootState } from "../store";

const EMPTY_VIEWED: readonly string[] = Object.freeze([]);

const viewedSelectorCache = new Map<string, (state: RootState) => readonly string[]>();

export const selectViewedFilesForPr = (
  prReference: string,
): ((state: RootState) => readonly string[]) => {
  let selector = viewedSelectorCache.get(prReference);
  if (!selector) {
    selector = (state: RootState) => state.viewedFiles.byReference[prReference] ?? EMPTY_VIEWED;
    viewedSelectorCache.set(prReference, selector);
  }
  return selector;
};

export const selectIsFileViewed =
  (prReference: string, path: string) =>
  (state: RootState): boolean =>
    (state.viewedFiles.byReference[prReference] ?? EMPTY_VIEWED).includes(path);
