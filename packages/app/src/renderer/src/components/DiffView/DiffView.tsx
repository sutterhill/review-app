import { PatchDiff, WorkerPoolContextProvider } from "@pierre/diffs/react";
import { useMemo } from "react";

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
        {files.map((file) => (
          <section
            className="scroll-mt-4 overflow-hidden border bg-background"
            data-change-status={file.status}
            key={file.path}
            ref={(element) => onFileElement(file.path, element)}
          >
            <DiffFileHeader file={file} />
            <Separator />
            {file.patch ? (
              <PatchDiff options={DIFF_OPTIONS} patch={file.patch} />
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                No textual diff is available for this file.
              </p>
            )}
          </section>
        ))}
      </div>
    </WorkerPoolContextProvider>
  );
};

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
