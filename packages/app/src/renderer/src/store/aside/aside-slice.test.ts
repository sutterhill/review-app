import { describe, expect, it } from "vitest";

import { asideActions, asideReducer } from "./aside-slice";

const REF = "acme/repo#1";
const OTHER = "acme/repo#2";

describe("asideReducer", () => {
  it("starts with an empty serializable state", () => {
    const state = asideReducer(undefined, { type: "unknown" });

    expect(state).toEqual({ references: [], status: "idle" });
    expect(() => JSON.stringify(state)).not.toThrow();
  });

  it("marks loading when a load is triggered", () => {
    const state = asideReducer(undefined, asideActions.loadAside());

    expect(state.status).toBe("loading");
    expect(state.references).toEqual([]);
  });

  it("sets a PR aside", () => {
    const state = asideReducer(undefined, asideActions.setAside(REF));

    expect(state.references).toEqual([REF]);
  });

  it("does not duplicate references when setting the same PR twice", () => {
    let state = asideReducer(undefined, asideActions.setAside(REF));
    state = asideReducer(state, asideActions.setAside(REF));

    expect(state.references).toEqual([REF]);
  });

  it("removes a reference when restored", () => {
    let state = asideReducer(undefined, asideActions.setAside(REF));
    state = asideReducer(state, asideActions.setAside(OTHER));
    state = asideReducer(state, asideActions.removeAside(REF));

    expect(state.references).toEqual([OTHER]);
  });

  it("is a no-op when removing a reference that is not set aside", () => {
    let state = asideReducer(undefined, asideActions.setAside(REF));
    state = asideReducer(state, asideActions.removeAside(OTHER));

    expect(state.references).toEqual([REF]);
  });

  it("hydrates references from disk, deduplicating entries and marking ready", () => {
    const state = asideReducer(undefined, asideActions.hydrateAside([REF, REF, OTHER]));

    expect(state.references).toEqual([REF, OTHER]);
    expect(state.status).toBe("ready");
  });
});
