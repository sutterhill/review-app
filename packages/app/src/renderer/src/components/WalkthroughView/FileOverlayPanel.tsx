import { PatchDiff } from "@pierre/diffs/react";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import type { PullRequestData, PullRequestFile } from "../../store/pr/pr-types";
import type { LineRange } from "../../store/walkthrough/walkthrough-types";
import { DIFF_OPTIONS, statusBadgeVariant, statusLabel } from "../diff-utils";
import { parseUnifiedDiff } from "../DiffView/diff-parser";

interface FileOverlayPanelProps {
  emphasizedRanges?: LineRange[];
  onClose: () => void;
  onOpenInChanges: () => void;
  pullRequest: PullRequestData;
  selectedPath: string;
}

export const FileOverlayPanel = ({
  emphasizedRanges,
  onClose,
  onOpenInChanges,
  pullRequest,
  selectedPath,
}: FileOverlayPanelProps): React.JSX.Element => {
  const file = useMemo(
    () => pullRequest.files.find((entry) => entry.filename === selectedPath),
    [pullRequest.files, selectedPath],
  );
  const parsedFiles = useMemo(
    () => parseUnifiedDiff(pullRequest.diff, pullRequest.files),
    [pullRequest.diff, pullRequest.files],
  );
  const parsedFile = parsedFiles.find((entry) => entry.path === selectedPath);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    if (!emphasizedRanges?.length || !containerRef.current) return;
    const target = containerRef.current.querySelector("[data-overlay-emphasis]");
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [emphasizedRanges, selectedPath]);

  if (!file) {
    return (
      <OverlayContainer onClose={onClose}>
        <p className="p-4 text-sm text-muted-foreground">File not found in this PR.</p>
      </OverlayContainer>
    );
  }

  const fileName = file.filename.split("/").pop() ?? file.filename;
  const directory = file.filename
    .slice(0, file.filename.length - fileName.length)
    .replace(/\/$/, "");

  return (
    <OverlayContainer onClose={onClose}>
      <header className="flex items-start justify-between gap-4 border-b bg-background px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant={statusBadgeVariant(file.status)}>{statusLabel(file.status)}</Badge>
            <h3 className="min-w-0 truncate font-mono text-sm font-semibold text-foreground">
              {fileName}
            </h3>
          </div>
          {directory ? (
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{directory}</p>
          ) : null}
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400">+{file.additions}</span>
            <span className="text-rose-600 dark:text-rose-400">-{file.deletions}</span>
            <button
              className="ml-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
              onClick={onOpenInChanges}
              type="button"
            >
              Open in Changes view
            </button>
          </div>
        </div>
        <button
          aria-label="Close file"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          <X className="size-4" />
        </button>
      </header>
      <Separator />
      <div className="flex-1 overflow-auto" ref={containerRef}>
        {parsedFile?.patch ? (
          <PatchDiff options={DIFF_OPTIONS} patch={parsedFile.patch} />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            No textual diff available for this file.
          </p>
        )}
      </div>
      <EmphasisMarkers file={file} ranges={emphasizedRanges ?? []} />
    </OverlayContainer>
  );
};

interface OverlayContainerProps {
  children: React.ReactNode;
  onClose: () => void;
}

const OverlayContainer = ({ children, onClose }: OverlayContainerProps): React.JSX.Element => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
    <button
      aria-label="Close file dialog"
      className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      type="button"
    />
    <section
      aria-label="File diff"
      className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border bg-background shadow-2xl"
    >
      {children}
    </section>
  </div>
);

const EmphasisMarkers = ({
  file: _file,
  ranges,
}: {
  file: PullRequestFile;
  ranges: LineRange[];
}): React.JSX.Element | null => {
  if (ranges.length === 0) return null;
  return <span aria-hidden="true" className="hidden" data-overlay-emphasis />;
};
