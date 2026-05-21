import { PatchDiff, WorkerPoolContextProvider } from "@pierre/diffs/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import type { PullRequestData } from "../../store/pr/pr-types";
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
  pullRequest: PullRequestData;
}

export const DiffView = ({ onFileElement, pullRequest }: DiffViewProps): React.JSX.Element => {
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
            key={file.path}
            onFileElement={onFileElement}
          />
        ))}
      </div>
    </WorkerPoolContextProvider>
  );
};

interface LazyDiffFileProps {
  eager?: boolean;
  file: ParsedDiffFile;
  onFileElement(path: string, element: HTMLElement | null): void;
}

const LazyDiffFile = memo(
  ({ eager = false, file, onFileElement }: LazyDiffFileProps): React.JSX.Element => {
    const sectionRef = useRef<HTMLElement | null>(null);
    const [isVisible, setIsVisible] = useState(eager);

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
        className="scroll-mt-4 overflow-hidden border bg-background"
        data-change-status={file.status}
        ref={setSectionElement}
      >
        <DiffFileHeader file={file} />
        <Separator />
        {isVisible && file.patch ? (
          <PatchDiff options={DIFF_OPTIONS} patch={file.patch} />
        ) : file.patch ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Loading diff…
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            No textual diff is available for this file.
          </p>
        )}
      </section>
    );
  },
);

const DiffFileHeader = ({ file }: { file: ParsedDiffFile }): React.JSX.Element => (
  <header className="flex items-center justify-between gap-4 bg-muted px-4 py-3">
    <div className="min-w-0">
      <Badge variant={statusBadgeVariant(file.status)}>{statusLabel(file.status)}</Badge>
      <h3 className="mt-2 break-all font-mono text-sm leading-snug text-foreground">{file.path}</h3>
      {file.previousPath ? (
        <p className="mt-1 break-all text-xs text-muted-foreground">
          Renamed from {file.previousPath}
        </p>
      ) : null}
    </div>
    <div className="flex shrink-0 items-center gap-2" aria-label="File change counts">
      <Badge variant="secondary">+{file.additions}</Badge>
      <Badge variant="destructive">-{file.deletions}</Badge>
    </div>
  </header>
);
