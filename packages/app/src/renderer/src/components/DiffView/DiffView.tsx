import { PatchDiff } from "@pierre/diffs/react";
import { useMemo } from "react";

import type { PullRequestData } from "../../store/pr/pr-types";
import { DIFF_OPTIONS, statusLabel, usePreloadedPatches } from "../diff-utils";
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
