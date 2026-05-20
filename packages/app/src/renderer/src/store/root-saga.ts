import { all } from "redux-saga/effects";

import { authSaga } from "./auth/sagas/auth-saga";
import { narrativeSaga } from "./narrative/sagas/narrative-saga";
import { orchestratorSaga } from "./orchestrator/sagas/orchestrator-saga";
import { prSaga } from "./pr/sagas/pr-saga";
import { reposSaga } from "./repos/sagas/repos-saga";

export function* rootSaga(): Generator {
  yield all([authSaga(), narrativeSaga(), orchestratorSaga(), prSaga(), reposSaga()]);
}
