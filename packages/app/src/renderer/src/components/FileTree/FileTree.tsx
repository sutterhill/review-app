import type { FileTreeRowDecorationContext, GitStatus } from "@pierre/trees";
import { FileTree as PierreFileTree, useFileTree } from "@pierre/trees/react";
import { useEffect, useMemo, useRef } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import type { PullRequestFile, PullRequestFileStatus } from "../../store/pr/pr-types";

interface ChangedFileTreeProps {
  files: PullRequestFile[];
  onSelect(path: string): void;
  selectedPath: string | null;
  viewedPaths?: ReadonlySet<string>;
}

const EMPTY_VIEWED_PATHS: ReadonlySet<string> = new Set();

export const ChangedFileTree = ({
  files,
  onSelect,
  selectedPath,
  viewedPaths = EMPTY_VIEWED_PATHS,
}: ChangedFileTreeProps): React.JSX.Element => {
  const paths = useMemo(() => files.map((file) => file.filename), [files]);
  const pathSet = useMemo(() => new Set(paths), [paths]);
  const statusByPath = useMemo(
    () => new Map(files.map((file) => [file.filename, file.status] as const)),
    [files],
  );
  const gitStatus = useMemo(
    () => files.map((file) => ({ path: file.filename, status: toGitStatus(file.status) })),
    [files],
  );
  const onSelectRef = useRef(onSelect);
  const pathSetRef = useRef(pathSet);
  const statusByPathRef = useRef(statusByPath);
  const viewedPathsRef = useRef(viewedPaths);
  const { model } = useFileTree({
    flattenEmptyDirectories: true,
    gitStatus,
    initialExpansion: "open",
    initialSelectedPaths: selectedPath ? [selectedPath] : [],
    onSelectionChange: (selectedPaths) => {
      const path = selectedPaths.find((candidatePath) => pathSetRef.current.has(candidatePath));
      if (path) {
        onSelectRef.current(path);
      }
    },
    paths,
    renderRowDecoration: (context) =>
      renderStatusDecoration(context, statusByPathRef.current, viewedPathsRef.current),
    search: true,
  });

  useEffect(() => {
    onSelectRef.current = onSelect;
    pathSetRef.current = pathSet;
    statusByPathRef.current = statusByPath;
    viewedPathsRef.current = viewedPaths;
  }, [onSelect, pathSet, statusByPath, viewedPaths]);

  useEffect(() => {
    model.resetPaths(paths);
    model.setGitStatus(gitStatus);
  }, [gitStatus, model, paths]);

  useEffect(() => {
    model.setGitStatus(gitStatus);
  }, [gitStatus, model, viewedPaths]);

  useEffect(() => {
    for (const path of model.getSelectedPaths()) {
      model.getItem(path)?.deselect();
    }

    if (selectedPath && pathSet.has(selectedPath)) {
      model.getItem(selectedPath)?.select();
      model.scrollToPath(selectedPath, { focus: false, offset: "nearest" });
    }
  }, [model, pathSet, selectedPath]);

  return (
    <ScrollArea className="h-full border bg-background" aria-label="Changed files">
      <PierreFileTree
        className={cn(
          "h-full text-sm",
          "[--trees-bg-override:var(--background)] [--trees-border-color-override:var(--border)]",
          "[--trees-fg-override:var(--foreground)] [--trees-selected-bg-override:var(--muted)]",
        )}
        model={model}
      />
    </ScrollArea>
  );
};

const renderStatusDecoration = (
  context: FileTreeRowDecorationContext,
  statusByPath: ReadonlyMap<string, PullRequestFileStatus>,
  viewedPaths: ReadonlySet<string>,
) => {
  const status = statusByPath.get(context.item.path);
  if (!status) return null;
  const isViewed = viewedPaths.has(context.item.path);
  if (isViewed) {
    return { text: `✓ ${shortStatusLabel(status)}`, title: `Viewed · ${statusLabel(status)}` };
  }
  return { text: shortStatusLabel(status), title: statusLabel(status) };
};

const toGitStatus = (status: PullRequestFileStatus): GitStatus => {
  if (status === "added" || status === "deleted" || status === "renamed") {
    return status;
  }

  return "modified";
};

const shortStatusLabel = (status: PullRequestFileStatus): string => {
  const labels: Record<PullRequestFileStatus, string> = {
    added: "A",
    deleted: "D",
    modified: "M",
    renamed: "R",
  };
  return labels[status];
};

const statusLabel = (status: PullRequestFileStatus): string => {
  const labels: Record<PullRequestFileStatus, string> = {
    added: "Added",
    deleted: "Deleted",
    modified: "Modified",
    renamed: "Renamed",
  };
  return labels[status];
};
