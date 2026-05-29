export type AsideStatus = "idle" | "loading" | "ready";

export interface AsideState {
  references: string[];
  status: AsideStatus;
}
