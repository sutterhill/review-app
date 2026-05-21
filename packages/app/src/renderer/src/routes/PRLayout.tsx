import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, NavLink, Outlet, useParams } from "react-router";

import { cn } from "@/lib/utils";

import { CubeLoader } from "../components/CubeLoader";
import { selectPrData, selectPrError } from "../store/pr/pr-selectors";
import { prActions } from "../store/pr/pr-slice";
import type { AppDispatch } from "../store/store";
import { selectWalkthroughStatus } from "../store/walkthrough/walkthrough-selectors";
import { walkthroughActions } from "../store/walkthrough/walkthrough-slice";
import { PRContext } from "./pr-context";

const navLinkClasses =
  "relative inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";
const activeNavLinkClasses =
  "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground";

export const PRLayout = (): React.JSX.Element => {
  const { number, owner, repo } = useParams();
  const dispatch = useDispatch<AppDispatch>();
  const prData = useSelector(selectPrData);
  const prError = useSelector(selectPrError);
  const walkthroughStatus = useSelector(selectWalkthroughStatus);
  const routeReference = owner && repo && number ? `${owner}/${repo}#${number}` : "";
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [sidebar, setSidebar] = useState<ReactNode | null>(null);
  const fileElements = useRef(new Map<string, HTMLElement>());
  const isWalkthroughGenerating =
    walkthroughStatus === "loading" || walkthroughStatus === "streaming";

  useEffect(() => {
    if (routeReference) {
      dispatch(prActions.fetchPr(routeReference));
    }
  }, [dispatch, routeReference]);

  useEffect(() => {
    setSelectedFilePath(prData?.files[0]?.filename ?? null);
  }, [prData]);

  useEffect(() => {
    if (prData) {
      dispatch(walkthroughActions.loadCachedWalkthrough());
    }
  }, [dispatch, prData]);

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

  const contextValue = useMemo(
    () =>
      prData ? { handleFileElement, handleFileSelect, prData, selectedFilePath, setSidebar } : null,
    [handleFileElement, handleFileSelect, prData, selectedFilePath, setSidebar],
  );

  if (!prData) {
    return (
      <div className="flex min-h-screen flex-col">
        {prError ? (
          <header className="flex items-center gap-4 border-b bg-background p-4">
            <Link
              className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              to="/"
            >
              Back
            </Link>
            <p className="text-sm text-destructive">{prError.message}</p>
          </header>
        ) : null}
        <CubeLoader />
      </div>
    );
  }

  return (
    <PRContext.Provider value={contextValue}>
      <div
        className={cn(
          "min-h-screen w-full",
          sidebar && "grid lg:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)]",
        )}
      >
        {sidebar ? (
          <aside className="sticky top-0 h-screen overflow-hidden border-r bg-card">
            {sidebar}
          </aside>
        ) : null}
        <div className="min-w-0">
          <div className="sticky top-0 z-10 bg-background">
            <header className="flex flex-col gap-2 border-b px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">
                    {prData.metadata.reference}
                  </p>
                  <h1 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
                    {prData.metadata.title}
                  </h1>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {prData.metadata.author.login} opened this PR with {prData.files.length} changed
                    files.
                  </p>
                </div>
                <Link
                  className="w-fit shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  to="/"
                >
                  Back
                </Link>
              </div>
            </header>
            <nav className="flex w-full gap-1 border-b px-4" aria-label="Pull request sections">
              <NavLink
                className={({ isActive }) => cn(navLinkClasses, isActive && activeNavLinkClasses)}
                to="walkthrough"
              >
                Walkthrough
                {isWalkthroughGenerating ? (
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                ) : null}
              </NavLink>
              <NavLink
                className={({ isActive }) => cn(navLinkClasses, isActive && activeNavLinkClasses)}
                to="diff"
              >
                Changes
              </NavLink>
              <NavLink
                className={({ isActive }) => cn(navLinkClasses, isActive && activeNavLinkClasses)}
                to="details"
              >
                Details
              </NavLink>
            </nav>
          </div>
          <Outlet />
        </div>
      </div>
    </PRContext.Provider>
  );
};
