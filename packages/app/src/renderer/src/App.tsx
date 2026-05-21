import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Route, Routes, useParams } from "react-router";

import { DiffView } from "./components/DiffView";
import { ChangedFileTree } from "./components/FileTree";
import { Login } from "./components/Login";
import { NarrativeView } from "./components/NarrativeView";
import { PRList } from "./components/PRList";
import { selectIsAuthenticated } from "./store/auth/auth-selectors";
import {
  selectNarrativeContent,
  selectNarrativeError,
} from "./store/narrative/narrative-selectors";
import { selectPrData, selectPrError } from "./store/pr/pr-selectors";
import { prActions } from "./store/pr/pr-slice";
import type { AppDispatch } from "./store/store";

const PullRequestRoute = (): React.JSX.Element => {
  const { number, owner, repo } = useParams();
  const dispatch = useDispatch<AppDispatch>();
  const prData = useSelector(selectPrData);
  const prError = useSelector(selectPrError);
  const narrativeContent = useSelector(selectNarrativeContent);
  const narrativeError = useSelector(selectNarrativeError);
  const routeReference = owner && repo && number ? `${owner}/${repo}#${number}` : "";
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const fileElements = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (routeReference) {
      dispatch(prActions.fetchPr(routeReference));
    }
  }, [dispatch, routeReference]);

  useEffect(() => {
    setSelectedFilePath(prData?.files[0]?.filename ?? null);
  }, [prData]);

  const handleFileElement = useCallback((path: string, element: HTMLElement | null): void => {
    if (element) {
      fileElements.current.set(path, element);
      return;
    }

    fileElements.current.delete(path);
  }, []);

  const handleFileSelect = useCallback((path: string): void => {
    setSelectedFilePath(path);
    requestAnimationFrame(() => {
      fileElements.current.get(path)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  return (
    <div
      className={
        prData
          ? "grid min-h-screen w-full lg:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)]"
          : "flex w-full max-w-2xl flex-col gap-5 p-4"
      }
    >
      {prData ? (
        <aside
          className="sticky top-0 h-screen overflow-hidden border-r bg-card"
          aria-label="Changed files"
        >
          <ChangedFileTree
            files={prData.files}
            onSelect={handleFileSelect}
            selectedPath={selectedFilePath}
          />
        </aside>
      ) : null}
      <div className="min-w-0">
        <header className="flex flex-col gap-4 border-b bg-background p-4">
          {prData ? (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">
                  {prData.metadata.reference}
                </p>
                <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                  {prData.metadata.title}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {prData.metadata.author.login} opened this PR with {prData.files.length} changed
                  files.
                </p>
              </div>
              <Link
                className="w-fit shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                to="/"
              >
                Back to pull requests
              </Link>
            </div>
          ) : (
            <Link
              className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              to="/"
            >
              Back to pull requests
            </Link>
          )}
          {narrativeError ? <p className="text-sm text-destructive">{narrativeError}</p> : null}
          {prError ? <p className="text-sm text-destructive">{prError.message}</p> : null}
        </header>
        {prData ? (
          narrativeContent ? (
            <NarrativeView
              narrative={narrativeContent}
              onFileElement={handleFileElement}
              pullRequest={prData}
            />
          ) : (
            <DiffView onFileElement={handleFileElement} pullRequest={prData} />
          )
        ) : null}
      </div>
    </div>
  );
};

export const App = (): React.JSX.Element => {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return (
    <main className="min-h-screen w-full bg-background text-foreground">
      {isAuthenticated ? (
        <Routes>
          <Route element={<PRList />} path="/" />
          <Route element={<PullRequestRoute />} path="/pr/:owner/:repo/:number" />
        </Routes>
      ) : (
        <Login />
      )}
    </main>
  );
};
