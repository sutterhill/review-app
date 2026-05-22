import { CheckIcon } from "@heroicons/react/16/solid";
import { WorkerPoolContextProvider } from "@pierre/diffs/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { selectThreadsForFile } from "../../store/comments/comments-selectors";
import type { PullRequestData } from "../../store/pr/pr-types";
import { CollapseChevron } from "../CollapseChevron";
import { CollapseContent } from "../CollapseContent";
import { AnnotatedPatchDiff } from "../Comments/AnnotatedPatchDiff";
import { DIFF_OPTIONS, statusBadgeVariant, statusLabel } from "../diff-utils";
import { parseUnifiedDiff, type ParsedDiffFile } from "./diff-parser";

const DIFF_WORKER_POOL_OPTIONS = {
  poolSize: 2,
  totalASTLRUCacheSize: 200,
  workerFactory: (): Worker =>
    new Worker(new URL("@pierre/diffs/worker/worker.js", import.meta.url), { type: "module" }),
};

const DIFF_HIGHLIGHTER_OPTIONS = {
  maxLineDiffLength: 1000,
  theme: DIFF_OPTIONS.theme,
  tokenizeMaxLineLength: 1000,
};

const EAGER_DIFF_FILE_COUNT = 3;

interface DiffViewProps {
  onFileElement(path: string, element: HTMLElement | null): void;
  onToggleViewed?: (path: string, viewed: boolean) => void;
  pullRequest: PullRequestData;
  viewedPaths?: ReadonlySet<string>;
}

export const DiffView = ({
  onFileElement,
  onToggleViewed,
  pullRequest,
  viewedPaths,
}: DiffViewProps): React.JSX.Element => {
  const files = useMemo(
    () => parseUnifiedDiff(pullRequest.diff, pullRequest.files),
    [pullRequest.diff, pullRequest.files],
  );

  if (files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No changed files were returned for this pull request.
      </p>
    );
  }

  return (
    <WorkerPoolContextProvider
      highlighterOptions={DIFF_HIGHLIGHTER_OPTIONS}
      poolOptions={DIFF_WORKER_POOL_OPTIONS}
    >
      <div className="flex flex-col gap-4" aria-label="Pull request diff">
        {files.map((file, index) => (
          <LazyDiffFile
            eager={index < EAGER_DIFF_FILE_COUNT}
            file={file}
            isViewed={viewedPaths?.has(file.path) ?? false}
            key={file.path}
            onFileElement={onFileElement}
            prReference={pullRequest.metadata.reference}
            onToggleViewed={onToggleViewed}
          />
        ))}
      </div>
    </WorkerPoolContextProvider>
  );
};

interface LazyDiffFileProps {
  eager?: boolean;
  file: ParsedDiffFile;
  isViewed: boolean;
  onFileElement(path: string, element: HTMLElement | null): void;
  onToggleViewed?: (path: string, viewed: boolean) => void;
  prReference: string;
}

const LazyDiffFile = memo(
  ({
    eager = false,
    file,
    isViewed,
    onFileElement,
    onToggleViewed,
    prReference,
  }: LazyDiffFileProps): React.JSX.Element => {
    const threads = useSelector(selectThreadsForFile(prReference, file.path));
    const sectionRef = useRef<HTMLElement | null>(null);
    const [isVisible, setIsVisible] = useState(eager);
    const [collapsed, setCollapsed] = useState(isViewed);

    useEffect(() => {
      setCollapsed(isViewed);
    }, [isViewed]);

    const handleToggleViewed = useCallback(
      (path: string, viewed: boolean) => {
        onToggleViewed?.(path, viewed);
        setCollapsed(viewed);
      },
      [onToggleViewed],
    );
    const toggleCollapsed = useCallback(() => setCollapsed((value) => !value), []);

    useEffect(() => {
      if (eager || isVisible || !file.patch) {
        return;
      }

      const element = sectionRef.current;
      if (!element) {
        return;
      }

      if (typeof IntersectionObserver === "undefined") {
        setIsVisible(true);
        return;
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        },
        { rootMargin: "200px 0px" },
      );

      observer.observe(element);
      return () => observer.disconnect();
    }, [eager, file.patch, isVisible]);

    const setSectionElement = useCallback(
      (element: HTMLElement | null) => {
        sectionRef.current = element;
        onFileElement(file.path, element);
      },
      [file.path, onFileElement],
    );

    return (
      <section
        className={cn(
          "scroll-mt-4 overflow-hidden border bg-background transition-opacity [container-type:inline-size]",
          isViewed && "opacity-60",
        )}
        data-change-status={file.status}
        ref={setSectionElement}
      >
        <DiffFileHeader
          collapsed={collapsed}
          file={file}
          isViewed={isViewed}
          onToggleCollapsed={toggleCollapsed}
          onToggleViewed={onToggleViewed ? handleToggleViewed : undefined}
        />
        <CollapseContent collapsed={collapsed}>
          <Separator />
          {isVisible && file.patch ? (
            <AnnotatedPatchDiff
              filePath={file.path}
              options={DIFF_OPTIONS}
              patch={file.patch}
              prReference={prReference}
              threads={threads}
            />
          ) : file.patch ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Loading diff…
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              No textual diff is available for this file.
            </p>
          )}
        </CollapseContent>
      </section>
    );
  },
);

interface DiffFileHeaderProps {
  collapsed: boolean;
  file: ParsedDiffFile;
  isViewed: boolean;
  onToggleCollapsed: () => void;
  onToggleViewed?: (path: string, viewed: boolean) => void;
}

const DiffFileHeader = ({
  collapsed,
  file,
  isViewed,
  onToggleCollapsed,
  onToggleViewed,
}: DiffFileHeaderProps): React.JSX.Element => (
  <header className="flex items-center justify-between gap-4 bg-muted px-4 py-3">
    <div className="flex min-w-0 items-start gap-2">
      <button
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand file diff" : "Collapse file diff"}
        className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
        onClick={onToggleCollapsed}
        type="button"
      >
        <CollapseChevron className="size-4" collapsed={collapsed} />
      </button>
      <div className="min-w-0">
        <Badge variant={statusBadgeVariant(file.status)}>{statusLabel(file.status)}</Badge>
        <h3 className="mt-2 break-all font-mono text-sm leading-snug text-foreground">
          {file.path}
        </h3>
        {file.previousPath ? (
          <p className="mt-1 break-all text-xs text-muted-foreground">
            Renamed from {file.previousPath}
          </p>
        ) : null}
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-2" aria-label="File change counts">
      <Badge variant="secondary">+{file.additions}</Badge>
      <Badge variant="destructive">-{file.deletions}</Badge>
      {onToggleViewed ? (
        <button
          aria-label={isViewed ? "Mark as unviewed" : "Mark as viewed"}
          aria-pressed={isViewed}
          className={cn(
            "ml-1 inline-flex size-5 items-center justify-center rounded-sm border text-muted-foreground transition-colors hover:text-foreground",
            isViewed
              ? "border-foreground/60 bg-foreground/10 text-foreground"
              : "border-border/60 bg-transparent",
          )}
          onClick={() => onToggleViewed(file.path, !isViewed)}
          type="button"
        >
          {isViewed ? <CheckIcon className="size-3.5" /> : null}
        </button>
      ) : null}
    </div>
  </header>
);
