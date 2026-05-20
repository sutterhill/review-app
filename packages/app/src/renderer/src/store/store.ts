import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";

import { appReducer } from "./app/app-slice";
import { authReducer } from "./auth/auth-slice";
import { narrativeReducer } from "./narrative/narrative-slice";
import { orchestratorReducer } from "./orchestrator/orchestrator-slice";
import { prReducer } from "./pr/pr-slice";
import { reposReducer } from "./repos/repos-slice";
import { rootSaga } from "./root-saga";

const sagaMiddleware = createSagaMiddleware();

export const store = configureStore({
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ thunk: false }).concat(sagaMiddleware),
  reducer: {
    app: appReducer,
    auth: authReducer,
    narrative: narrativeReducer,
    orchestrator: orchestratorReducer,
    pr: prReducer,
    repos: reposReducer,
  },
});

sagaMiddleware.run(rootSaga);

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
