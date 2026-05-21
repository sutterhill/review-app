import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  WalkthroughView,
  extractWalkthroughHeadings,
  type WalkthroughHeading,
} from "../components/WalkthroughView";
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
      <WalkthroughSidebar
        headings={headings}
        isGenerating={isWalkthroughGenerating}
        onRegenerate={handleRegenerate}
      />,
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

const WalkthroughSidebar = ({
  headings,
  isGenerating,
  onRegenerate,
}: {
  headings: WalkthroughHeading[];
  isGenerating: boolean;
  onRegenerate: () => void;
}): React.JSX.Element => {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      {
        rootMargin: "-10% 0px -80% 0px",
        threshold: 0,
      },
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  return (
    <div className="flex h-full flex-col">
      {headings.length > 0 ? (
        <nav
          className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto p-3"
          aria-label="Walkthrough sections"
        >
          {headings.map((heading) => (
            <button
              className={cn(
                "rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                activeId === heading.id && "bg-muted font-medium text-foreground",
              )}
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
          disabled={isGenerating}
          onClick={onRegenerate}
          title="Regenerate walkthrough"
          type="button"
        >
          <RefreshCw className="size-4" />
        </button>
      </div>
    </div>
  );
};
