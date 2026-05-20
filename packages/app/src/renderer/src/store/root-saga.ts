import { all } from "redux-saga/effects";

import { narrativeSaga } from "./narrative/sagas/narrative-saga";
import { orchestratorSaga } from "./orchestrator/sagas/orchestrator-saga";
import { prSaga } from "./pr/sagas/pr-saga";

export function* rootSaga(): Generator {
  yield all([narrativeSaga(), orchestratorSaga(), prSaga()]);
}
