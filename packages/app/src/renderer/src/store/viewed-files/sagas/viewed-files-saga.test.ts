import { call, put, select } from "redux-saga/effects";
import { describe, expect, it } from "vitest";

import { selectViewedFilesForPr } from "../viewed-files-selectors";
import { viewedFilesActions } from "../viewed-files-slice";
import {
  loadViewedFilesFromDisk,
  loadViewedFilesSaga,
  persistViewedFilesSaga,
  saveViewedFilesToDisk,
} from "./viewed-files-saga";

const REF = "acme/repo#1";

describe("loadViewedFilesSaga", () => {
  it("hydrates the slice with paths loaded from disk", () => {
    const generator = loadViewedFilesSaga(viewedFilesActions.loadViewedFiles({ prReference: REF }));

    expect(generator.next().value).toEqual(call(loadViewedFilesFromDisk, REF));
    expect(generator.next(["src/a.ts", "src/b.ts"]).value).toEqual(
      put(
        viewedFilesActions.hydrateViewedFiles({
          paths: ["src/a.ts", "src/b.ts"],
          prReference: REF,
        }),
      ),
    );
    expect(generator.next().done).toBe(true);
  });
});

describe("persistViewedFilesSaga", () => {
  it("persists the latest paths for the PR after a viewed toggle", () => {
    const generator = persistViewedFilesSaga(
      viewedFilesActions.setViewed({ path: "src/a.ts", prReference: REF, viewed: true }),
    );

    expect(generator.next().value).toEqual(select(selectViewedFilesForPr(REF)));
    expect(generator.next(["src/a.ts"]).value).toEqual(
      call(saveViewedFilesToDisk, REF, ["src/a.ts"]),
    );
    expect(generator.next().done).toBe(true);
  });
});
