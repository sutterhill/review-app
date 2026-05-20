export type NarrativeStatus = "failed" | "idle" | "loading" | "streaming" | "succeeded";

export interface NarrativeState {
  content: string;
  error: string | null;
  status: NarrativeStatus;
}
