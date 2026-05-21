import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate, Route, Routes } from "react-router";

import { Login } from "./components/Login";
import { PRList } from "./components/PRList";
import { DetailsRoute } from "./routes/DetailsRoute";
import { DiffRoute } from "./routes/DiffRoute";
import { PRLayout } from "./routes/PRLayout";
import { WalkthroughRoute } from "./routes/WalkthroughRoute";
import { selectIsAuthenticated } from "./store/auth/auth-selectors";
import { reposActions } from "./store/repos/repos-slice";
import type { AppDispatch } from "./store/store";

export const App = (): React.JSX.Element => {
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  useEffect(() => {
    dispatch(reposActions.loadSavedRepos());
  }, [dispatch]);

  return (
    <main className="min-h-screen w-full bg-background text-foreground">
      {isAuthenticated ? (
        <Routes>
          <Route element={<PRList />} path="/" />
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
