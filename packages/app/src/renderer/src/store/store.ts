import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";

import { appReducer } from "./app/app-slice";
import { narrativeReducer } from "./narrative/narrative-slice";
import { prReducer } from "./pr/pr-slice";
import { rootSaga } from "./root-saga";

const sagaMiddleware = createSagaMiddleware();

export const store = configureStore({
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ thunk: false }).concat(sagaMiddleware),
  reducer: {
    app: appReducer,
    narrative: narrativeReducer,
    pr: prReducer,
  },
});

sagaMiddleware.run(rootSaga);

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
