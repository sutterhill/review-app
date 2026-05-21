import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";

import { Skeleton } from "@/components/ui/skeleton";

import { WalkthroughView, extractWalkthroughHeadings } from "../components/WalkthroughView";
import type { AppDispatch } from "../store/store";
import {
  selectWalkthroughContent,
  selectWalkthroughError,
  selectWalkthroughStatus,
} from "../store/walkthrough/walkthrough-selectors";
import { walkthroughActions } from "../store/walkthrough/walkthrough-slice";
import { usePRContext } from "./pr-context";

export const WalkthroughRoute = (): React.JSX.Element => {
  const { setSidebar } = usePRContext();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const walkthroughContent = useSelector(selectWalkthroughContent);
  const walkthroughError = useSelector(selectWalkthroughError);
  const walkthroughStatus = useSelector(selectWalkthroughStatus);
  const isWalkthroughGenerating =
    walkthroughStatus === "loading" || walkthroughStatus === "streaming";
  const headings = useMemo(
    () => (walkthroughContent ? extractWalkthroughHeadings(walkthroughContent) : []),
    [walkthroughContent],
  );
  const handleRegenerate = useCallback(() => {
    dispatch(walkthroughActions.generateWalkthrough());
  }, [dispatch]);
  const handleFileClick = useCallback(
    (_path: string) => {
      navigate("../diff");
    },
    [navigate],
  );

  useEffect(() => {
    setSidebar(
      <div className="flex h-full flex-col">
        {headings.length > 0 ? (
          <nav
            className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto p-3"
            aria-label="Walkthrough sections"
          >
            {headings.map((heading) => (
              <button
                className="rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                key={heading.id}
                onClick={() => {
                  const el = document.getElementById(heading.id);
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                style={{ paddingLeft: `${(heading.level - 1) * 12 + 8}px` }}
                type="button"
              >
                {heading.text}
              </button>
            ))}
          </nav>
        ) : null}
        <div className="mt-auto shrink-0 border-t p-3">
          <button
            aria-label="Regenerate walkthrough"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            disabled={isWalkthroughGenerating}
            onClick={handleRegenerate}
            title="Regenerate walkthrough"
            type="button"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>,
    );
    return () => setSidebar(null);
  }, [handleRegenerate, headings, isWalkthroughGenerating, setSidebar]);

  return (
    <div className="p-4">
      {walkthroughStatus === "loading" ? (
        <div className="flex max-w-[70ch] flex-col gap-3" aria-live="polite">
          <p className="text-sm text-muted-foreground">Generating walkthrough…</p>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
        </div>
      ) : walkthroughContent ? (
        <div className="flex flex-col gap-3">
          {isWalkthroughGenerating ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Generating walkthrough…
            </p>
          ) : null}
          <WalkthroughView
            onFileClick={handleFileClick}
            showDiffs={walkthroughStatus === "succeeded"}
            walkthrough={walkthroughContent}
          />
        </div>
      ) : walkthroughStatus === "streaming" ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Generating walkthrough…
        </p>
      ) : walkthroughError ? (
        <p className="text-sm text-destructive">{walkthroughError}</p>
      ) : null}
    </div>
  );
};
