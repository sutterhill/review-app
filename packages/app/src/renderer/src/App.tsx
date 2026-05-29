import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate, Route, Routes } from "react-router";

import { KanbanBoard } from "./components/KanbanBoard";
import { Login } from "./components/Login";
import { DetailsRoute } from "./routes/DetailsRoute";
import { DiffRoute } from "./routes/DiffRoute";
import { PRLayout } from "./routes/PRLayout";
import { WalkthroughRoute } from "./routes/WalkthroughRoute";
import { asideActions } from "./store/aside/aside-slice";
import { selectIsAuthenticated } from "./store/auth/auth-selectors";
import { reposActions } from "./store/repos/repos-slice";
import type { AppDispatch } from "./store/store";

export const App = (): React.JSX.Element => {
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  useEffect(() => {
    dispatch(reposActions.loadSavedRepos());
    dispatch(asideActions.loadAside());
  }, [dispatch]);

  return (
    <main className="min-h-screen w-full bg-background text-foreground">
      {isAuthenticated ? (
        <Routes>
          <Route element={<KanbanBoard />} path="/" />
          <Route element={<PRLayout />} path="/pr/:owner/:repo/:number">
            <Route index element={<Navigate replace to="walkthrough" />} />
            <Route element={<DiffRoute />} path="diff" />
            <Route element={<WalkthroughRoute />} path="walkthrough" />
            <Route element={<DetailsRoute />} path="details" />
          </Route>
        </Routes>
      ) : (
        <Login />
      )}
    </main>
  );
};
