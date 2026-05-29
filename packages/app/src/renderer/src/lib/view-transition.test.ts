import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runWithViewTransition, sanitizeViewTransitionName } from "./view-transition";

type StartViewTransitionStub = ((callback: () => void | Promise<void>) => unknown) | undefined;

const globalRef = globalThis as { document?: { startViewTransition?: StartViewTransitionStub } };
const ORIGINAL_DOCUMENT = globalRef.document;

beforeEach(() => {
  globalRef.document = { startViewTransition: undefined };
});

afterEach(() => {
  if (ORIGINAL_DOCUMENT === undefined) {
    delete globalRef.document;
  } else {
    globalRef.document = ORIGINAL_DOCUMENT;
  }
});

describe("sanitizeViewTransitionName", () => {
  it("prefixes with pr- and replaces invalid chars with underscores", () => {
    expect(sanitizeViewTransitionName("octo/repo#42")).toBe("pr-octo_repo_42");
  });

  it("preserves alphanumerics, underscores, and hyphens", () => {
    expect(sanitizeViewTransitionName("my-repo_1")).toBe("pr-my-repo_1");
  });
});

describe("runWithViewTransition", () => {
  it("invokes the callback synchronously when startViewTransition is unavailable", () => {
    const callback = vi.fn();

    runWithViewTransition(callback);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("delegates to document.startViewTransition when available", () => {
    const callback = vi.fn();
    const start = vi.fn((cb: () => void) => {
      cb();

      return { finished: Promise.resolve() };
    });
    if (globalRef.document) {
      globalRef.document.startViewTransition = start;
    }

    runWithViewTransition(callback);

    expect(start).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
