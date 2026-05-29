import { all } from "redux-saga/effects";

import { asideSaga } from "./aside/sagas/aside-saga";
import { authSaga } from "./auth/sagas/auth-saga";
import { commentsSaga } from "./comments/sagas/comments-saga";
import { orchestratorSaga } from "./orchestrator/sagas/orchestrator-saga";
import { prSaga } from "./pr/sagas/pr-saga";
import { reposSaga } from "./repos/sagas/repos-saga";
import { viewedFilesSaga } from "./viewed-files/sagas/viewed-files-saga";
import { walkthroughSaga } from "./walkthrough/sagas/walkthrough-saga";

export function* rootSaga(): Generator {
  yield all([
    asideSaga(),
    authSaga(),
    commentsSaga(),
    walkthroughSaga(),
    orchestratorSaga(),
    prSaga(),
    reposSaga(),
    viewedFilesSaga(),
  ]);
}
