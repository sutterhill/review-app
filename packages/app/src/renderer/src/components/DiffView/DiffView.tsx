import { PatchDiff } from "@pierre/diffs/react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import type { PullRequestData } from "../../store/pr/pr-types";
import { DIFF_OPTIONS, statusBadgeVariant, statusLabel, usePreloadedPatches } from "../diff-utils";
import { parseUnifiedDiff, type ParsedDiffFile } from "./diff-parser";

interface DiffViewProps {
  onFileElement(path: string, element: HTMLElement | null): void;
  pullRequest: PullRequestData;
}

export const DiffView = ({ onFileElement, pullRequest }: DiffViewProps): React.JSX.Element => {
  const files = useMemo(
    () => parseUnifiedDiff(pullRequest.diff, pullRequest.files),
    [pullRequest.diff, pullRequest.files],
  );
  const preloadedHtml = usePreloadedPatches(files);

  if (files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No changed files were returned for this pull request.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4" aria-label="Pull request diff">
      {files.map((file) => (
        <section
          className="scroll-mt-4 overflow-hidden rounded-lg border bg-background"
          data-change-status={file.status}
          key={file.path}
          ref={(element) => onFileElement(file.path, element)}
        >
          <DiffFileHeader file={file} />
          <Separator />
          {file.patch ? (
            <PatchDiff
              disableWorkerPool={true}
              options={DIFF_OPTIONS}
              patch={file.patch}
              prerenderedHTML={preloadedHtml[file.path]}
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              No textual diff is available for this file.
            </p>
          )}
        </section>
      ))}
    </div>
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
