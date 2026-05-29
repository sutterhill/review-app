import { call, put, select } from "redux-saga/effects";
import { describe, expect, it } from "vitest";

import { selectAsideReferences } from "../aside-selectors";
import { asideActions } from "../aside-slice";
import { loadAsideFromDisk, loadAsideSaga, persistAsideSaga, saveAsideToDisk } from "./aside-saga";

const REF = "acme/repo#1";

describe("loadAsideSaga", () => {
  it("hydrates the slice with references loaded from disk", () => {
    const generator = loadAsideSaga();

    expect(generator.next().value).toEqual(call(loadAsideFromDisk));
    expect(generator.next([REF, "acme/repo#2"]).value).toEqual(
      put(asideActions.hydrateAside([REF, "acme/repo#2"])),
    );
    expect(generator.next().done).toBe(true);
  });
});

describe("persistAsideSaga", () => {
  it("persists the latest references after a set-aside", () => {
    const generator = persistAsideSaga(asideActions.setAside(REF));

    expect(generator.next().value).toEqual(select(selectAsideReferences));
    expect(generator.next([REF]).value).toEqual(call(saveAsideToDisk, [REF]));
    expect(generator.next().done).toBe(true);
  });

  it("persists the latest references after a restore", () => {
    const generator = persistAsideSaga(asideActions.removeAside(REF));

    expect(generator.next().value).toEqual(select(selectAsideReferences));
    expect(generator.next([]).value).toEqual(call(saveAsideToDisk, []));
    expect(generator.next().done).toBe(true);
  });
});
