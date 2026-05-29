import type { PayloadAction } from "@reduxjs/toolkit";
import { call, debounce, put, select, takeEvery } from "redux-saga/effects";

import { selectAsideReferences } from "../aside-selectors";
import { asideActions } from "../aside-slice";

export const loadAsideFromDisk = async (): Promise<string[]> => {
  if (typeof window === "undefined" || !window.reviewAppAside) {
    return [];
  }
  return window.reviewAppAside.load();
};

export const saveAsideToDisk = async (references: string[]): Promise<void> => {
  if (typeof window === "undefined" || !window.reviewAppAside) {
    return;
  }
  await window.reviewAppAside.save(references);
};

export function* loadAsideSaga(): Generator {
  const references = (yield call(loadAsideFromDisk)) as string[];
  yield put(asideActions.hydrateAside(references));
}

export function* persistAsideSaga(_action: PayloadAction<string>): Generator {
  const references = (yield select(selectAsideReferences)) as string[];
  yield call(saveAsideToDisk, references);
}

export function* asideSaga(): Generator {
  yield takeEvery(asideActions.loadAside.type, loadAsideSaga);
  yield debounce(150, asideActions.setAside.type, persistAsideSaga);
  yield debounce(150, asideActions.removeAside.type, persistAsideSaga);
}
