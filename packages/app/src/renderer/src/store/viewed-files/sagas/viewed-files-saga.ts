import type { PayloadAction } from "@reduxjs/toolkit";
import { call, debounce, put, select, takeEvery } from "redux-saga/effects";

import { selectViewedFilesForPr } from "../viewed-files-selectors";
import { viewedFilesActions } from "../viewed-files-slice";

export const loadViewedFilesFromDisk = async (prReference: string): Promise<string[]> => {
  if (typeof window === "undefined" || !window.reviewAppViewedFiles) {
    return [];
  }
  return window.reviewAppViewedFiles.load(prReference);
};

export const saveViewedFilesToDisk = async (
  prReference: string,
  paths: string[],
): Promise<void> => {
  if (typeof window === "undefined" || !window.reviewAppViewedFiles) {
    return;
  }
  await window.reviewAppViewedFiles.save(prReference, paths);
};

export function* loadViewedFilesSaga(action: PayloadAction<{ prReference: string }>): Generator {
  const paths = (yield call(loadViewedFilesFromDisk, action.payload.prReference)) as string[];
  yield put(
    viewedFilesActions.hydrateViewedFiles({
      paths,
      prReference: action.payload.prReference,
    }),
  );
}

export function* persistViewedFilesSaga(
  action: PayloadAction<{ path: string; prReference: string; viewed: boolean }>,
): Generator {
  const paths = (yield select(selectViewedFilesForPr(action.payload.prReference))) as string[];
  yield call(saveViewedFilesToDisk, action.payload.prReference, paths);
}

export function* viewedFilesSaga(): Generator {
  yield takeEvery(viewedFilesActions.loadViewedFiles.type, loadViewedFilesSaga);
  yield debounce(150, viewedFilesActions.setViewed.type, persistViewedFilesSaga);
}
