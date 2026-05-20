import type { RootState } from "../store";
import type { NarrativeStatus } from "./narrative-types";

export const selectNarrativeContent = (state: RootState): string => state.narrative.content;
export const selectNarrativeError = (state: RootState): string | null => state.narrative.error;
export const selectNarrativeStatus = (state: RootState): NarrativeStatus => state.narrative.status;
