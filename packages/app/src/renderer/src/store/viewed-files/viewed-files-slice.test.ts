import { describe, expect, it } from "vitest";

import { viewedFilesActions, viewedFilesReducer } from "./viewed-files-slice";

const REF = "acme/repo#1";

describe("viewedFilesReducer", () => {
  it("starts with an empty serializable map", () => {
    const state = viewedFilesReducer(undefined, { type: "unknown" });

    expect(state).toEqual({ byReference: {} });
    expect(() => JSON.stringify(state)).not.toThrow();
  });

  it("marks a file as viewed", () => {
    const state = viewedFilesReducer(
      undefined,
      viewedFilesActions.setViewed({ path: "src/a.ts", prReference: REF, viewed: true }),
    );

    expect(state.byReference[REF]).toEqual(["src/a.ts"]);
  });

  it("does not duplicate paths when marking the same file twice", () => {
    let state = viewedFilesReducer(
      undefined,
      viewedFilesActions.setViewed({ path: "src/a.ts", prReference: REF, viewed: true }),
    );
    state = viewedFilesReducer(
      state,
      viewedFilesActions.setViewed({ path: "src/a.ts", prReference: REF, viewed: true }),
    );

    expect(state.byReference[REF]).toEqual(["src/a.ts"]);
  });

  it("removes a path when unmarking it", () => {
    let state = viewedFilesReducer(
      undefined,
      viewedFilesActions.setViewed({ path: "src/a.ts", prReference: REF, viewed: true }),
    );
    state = viewedFilesReducer(
      state,
      viewedFilesActions.setViewed({ path: "src/b.ts", prReference: REF, viewed: true }),
    );
    state = viewedFilesReducer(
      state,
      viewedFilesActions.setViewed({ path: "src/a.ts", prReference: REF, viewed: false }),
    );

    expect(state.byReference[REF]).toEqual(["src/b.ts"]);
  });

  it("hydrates viewed files from disk, deduplicating entries", () => {
    const state = viewedFilesReducer(
      undefined,
      viewedFilesActions.hydrateViewedFiles({
        paths: ["src/a.ts", "src/a.ts", "src/b.ts"],
        prReference: REF,
      }),
    );

    expect(state.byReference[REF]).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("isolates viewed paths per PR reference", () => {
    let state = viewedFilesReducer(
      undefined,
      viewedFilesActions.setViewed({ path: "src/a.ts", prReference: REF, viewed: true }),
    );
    state = viewedFilesReducer(
      state,
      viewedFilesActions.setViewed({
        path: "src/x.ts",
        prReference: "acme/repo#2",
        viewed: true,
      }),
    );

    expect(state.byReference[REF]).toEqual(["src/a.ts"]);
    expect(state.byReference["acme/repo#2"]).toEqual(["src/x.ts"]);
  });
});
