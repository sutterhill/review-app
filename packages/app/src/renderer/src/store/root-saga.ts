import { all } from "redux-saga/effects";

import { authSaga } from "./auth/sagas/auth-saga";
import { orchestratorSaga } from "./orchestrator/sagas/orchestrator-saga";
import { prSaga } from "./pr/sagas/pr-saga";
import { reposSaga } from "./repos/sagas/repos-saga";
import { walkthroughSaga } from "./walkthrough/sagas/walkthrough-saga";

export function* rootSaga(): Generator {
  yield all([authSaga(), walkthroughSaga(), orchestratorSaga(), prSaga(), reposSaga()]);
}
