import type { RootState } from "../store";

export const selectAsideReferences = (state: RootState): string[] => state.aside.references;

export const selectIsAside =
  (reference: string) =>
  (state: RootState): boolean =>
    state.aside.references.includes(reference);
