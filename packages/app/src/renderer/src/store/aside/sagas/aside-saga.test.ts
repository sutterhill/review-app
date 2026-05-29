import { call, put, select } from "redux-saga/effects";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { selectAsideReferences } from "../aside-selectors";
import { asideActions } from "../aside-slice";
import { loadAsideFromDisk, loadAsideSaga, persistAsideSaga, saveAsideToDisk } from "./aside-saga";

const REF = "acme/repo#1";

describe("loadAsideSaga", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("hydrates the slice with references loaded from disk", () => {
    const generator = loadAsideSaga();

    expect(generator.next().value).toEqual(call(loadAsideFromDisk));
    expect(generator.next([REF, "acme/repo#2"]).value).toEqual(
      put(asideActions.hydrateAside([REF, "acme/repo#2"])),
    );
    expect(generator.next().done).toBe(true);
  });

  it("hydrates with an empty list and warns when the bridge throws", () => {
    const generator = loadAsideSaga();

    expect(generator.next().value).toEqual(call(loadAsideFromDisk));
    expect(generator.throw(new Error("ipc failed")).value).toEqual(
      put(asideActions.hydrateAside([])),
    );
    expect(generator.next().done).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe("persistAsideSaga", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

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

  it("swallows persist failures and warns instead of bubbling", () => {
    const generator = persistAsideSaga(asideActions.setAside(REF));

    expect(generator.next().value).toEqual(select(selectAsideReferences));
    expect(generator.next([REF]).value).toEqual(call(saveAsideToDisk, [REF]));
    expect(generator.throw(new Error("ipc failed")).done).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });
});
