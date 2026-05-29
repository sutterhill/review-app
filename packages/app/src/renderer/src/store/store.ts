import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";

import { asideReducer } from "./aside/aside-slice";
import { authReducer } from "./auth/auth-slice";
import { commentsReducer } from "./comments/comments-slice";
import { orchestratorReducer } from "./orchestrator/orchestrator-slice";
import { prReducer } from "./pr/pr-slice";
import { reposReducer } from "./repos/repos-slice";
import { rootSaga } from "./root-saga";
import { viewedFilesReducer } from "./viewed-files/viewed-files-slice";
import { walkthroughReducer } from "./walkthrough/walkthrough-slice";

const sagaMiddleware = createSagaMiddleware();

export const store = configureStore({
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ thunk: false }).concat(sagaMiddleware),
  reducer: {
    aside: asideReducer,
    auth: authReducer,
    comments: commentsReducer,
    walkthrough: walkthroughReducer,
    orchestrator: orchestratorReducer,
    pr: prReducer,
    repos: reposReducer,
    viewedFiles: viewedFilesReducer,
  },
});

sagaMiddleware.run(rootSaga);

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
