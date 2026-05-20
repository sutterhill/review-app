import { PatchDiff, type PatchDiffProps } from "@pierre/diffs/react";
import { preloadPatchDiff } from "@pierre/diffs/ssr";
import { useEffect, useMemo, useState } from "react";

import type { PullRequestData } from "../../store/pr/pr-types";
import { parseUnifiedDiff, type ParsedDiffFile } from "./diff-parser";

type PatchDiffOptions = NonNullable<PatchDiffProps<undefined>["options"]>;

const DIFF_OPTIONS: PatchDiffOptions = {
  diffIndicators: "classic",
  diffStyle: "unified",
  disableLineNumbers: false,
  hunkSeparators: "line-info",
  overflow: "wrap",
  stickyHeader: true,
  theme: { dark: "github-dark", light: "github-light" },
  themeType: "system",
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
  const preloadedHtml = usePreloadedPatches(files);

  if (files.length === 0) {
    return <p className="empty-state">No changed files were returned for this pull request.</p>;
  }

  return (
    <div className="diff-view" aria-label="Pull request diff">
      {files.map((file) => (
        <section
          className="diff-file"
          data-change-status={file.status}
          key={file.path}
          ref={(element) => onFileElement(file.path, element)}
        >
          <DiffFileHeader file={file} />
          {file.patch ? (
            <PatchDiff
              disableWorkerPool={true}
              options={DIFF_OPTIONS}
              patch={file.patch}
              prerenderedHTML={preloadedHtml[file.path]}
            />
          ) : (
            <p className="empty-state">No textual diff is available for this file.</p>
          )}
        </section>
      ))}
    </div>
  );
};

const usePreloadedPatches = (files: ParsedDiffFile[]): Record<string, string> => {
  const [preloadedHtml, setPreloadedHtml] = useState<Record<string, string>>({});

  useEffect(() => {
    let isCancelled = false;
    const preload = async (): Promise<void> => {
      const entries = await Promise.all(
        files
          .filter((file) => file.patch.length > 0)
          .map(async (file) => {
            const result = await preloadPatchDiff({ options: DIFF_OPTIONS, patch: file.patch });
            return [file.path, result.prerenderedHTML] as const;
          }),
      );

      if (!isCancelled) {
        setPreloadedHtml(Object.fromEntries(entries));
      }
    };

    setPreloadedHtml({});
    preload().catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, [files]);

  return preloadedHtml;
};

const DiffFileHeader = ({ file }: { file: ParsedDiffFile }): React.JSX.Element => (
  <header className="diff-file-header">
    <div>
      <span className="status-pill">{statusLabel(file.status)}</span>
      <h3>{file.path}</h3>
      {file.previousPath ? <p>Renamed from {file.previousPath}</p> : null}
    </div>
    <p>
      <span className="additions">+{file.additions}</span> /{" "}
      <span className="deletions">-{file.deletions}</span>
    </p>
  </header>
);

const statusLabel = (status: ParsedDiffFile["status"]): string => {
  const labels: Record<ParsedDiffFile["status"], string> = {
    added: "Added",
    deleted: "Deleted",
    modified: "Modified",
    renamed: "Renamed",
  };
  return labels[status];
};
