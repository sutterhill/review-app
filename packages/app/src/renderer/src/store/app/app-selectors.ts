import type { RootState } from "../store";

export const selectAppName = (state: RootState): string => state.app.name;
