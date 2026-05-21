import { createContext, useContext, type ReactNode } from "react";

import type { PullRequestData } from "../store/pr/pr-types";

export interface PRContextValue {
  prData: PullRequestData;
  handleFileSelect: (path: string) => void;
  handleFileElement: (path: string, element: HTMLElement | null) => void;
  selectedFilePath: string | null;
  setSidebar: (content: ReactNode | null) => void;
}

export const PRContext = createContext<PRContextValue | null>(null);

export const usePRContext = (): PRContextValue => {
  const ctx = useContext(PRContext);
  if (!ctx) throw new Error("usePRContext must be used within PRLayout");
  return ctx;
};
