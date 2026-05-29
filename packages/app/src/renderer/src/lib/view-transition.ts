import { flushSync } from "react-dom";

type StartViewTransition = (callback: () => void | Promise<void>) => unknown;

const getStartViewTransition = (): StartViewTransition | null => {
  if (typeof document === "undefined") {
    return null;
  }

  const candidate = (document as Document & { startViewTransition?: StartViewTransition })
    .startViewTransition;

  return typeof candidate === "function" ? candidate.bind(document) : null;
};

export const runWithViewTransition = (callback: () => void): void => {
  const start = getStartViewTransition();

  if (!start) {
    callback();

    return;
  }

  start(() => {
    flushSync(callback);
  });
};

export const sanitizeViewTransitionName = (value: string): string =>
  `pr-${value.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
