import type { FileTreeRowDecorationContext, GitStatus } from "@pierre/trees";
import { FileTree as PierreFileTree, useFileTree } from "@pierre/trees/react";
import { useEffect, useMemo, useRef } from "react";

import type { PullRequestFile, PullRequestFileStatus } from "../../store/pr/pr-types";

interface ChangedFileTreeProps {
  files: PullRequestFile[];
  onSelect(path: string): void;
  selectedPath: string | null;
}

export const ChangedFileTree = ({
  files,
  onSelect,
  selectedPath,
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
    renderRowDecoration: (context) => renderStatusDecoration(context, statusByPathRef.current),
    search: true,
  });

  useEffect(() => {
    onSelectRef.current = onSelect;
    pathSetRef.current = pathSet;
    statusByPathRef.current = statusByPath;
  }, [onSelect, pathSet, statusByPath]);

  useEffect(() => {
    model.resetPaths(paths);
    model.setGitStatus(gitStatus);
  }, [gitStatus, model, paths]);

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
    <PierreFileTree
      className="changed-file-tree"
      header={<strong>Changed files</strong>}
      model={model}
      style={{ height: "100%" }}
    />
  );
};

const renderStatusDecoration = (
  context: FileTreeRowDecorationContext,
  statusByPath: ReadonlyMap<string, PullRequestFileStatus>,
) => {
  const status = statusByPath.get(context.item.path);
  return status ? { text: shortStatusLabel(status), title: statusLabel(status) } : null;
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
