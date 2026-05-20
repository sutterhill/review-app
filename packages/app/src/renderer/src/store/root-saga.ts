import { all } from "redux-saga/effects";

import { prSaga } from "./pr/sagas/pr-saga";

export function* rootSaga(): Generator {
  yield all([prSaga()]);
}
