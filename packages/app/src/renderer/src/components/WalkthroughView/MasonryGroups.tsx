import { useMemo } from "react";

import type { PullRequestFile } from "../../store/pr/pr-types";
import type { LineRange, WalkthroughGroup } from "../../store/walkthrough/walkthrough-types";
import { FileMasonryCard } from "./FileMasonryCard";

interface MasonryGroupsProps {
  activeFiles: ReadonlySet<string>;
  emphasizedRanges: Record<string, LineRange[]>;
  files: PullRequestFile[];
  groups: WalkthroughGroup[];
  onSelect: (path: string) => void;
  selectedPath: null | string;
}

interface GroupRender {
  files: PullRequestFile[];
  isUngrouped?: boolean;
  title: string;
}

export const MasonryGroups = ({
  activeFiles,
  emphasizedRanges,
  files,
  groups,
  onSelect,
  selectedPath,
}: MasonryGroupsProps): React.JSX.Element => {
  const layout = useMemo<GroupRender[]>(() => buildGroupLayout(files, groups), [files, groups]);
  const maxFileLines = useMemo(
    () => files.reduce((max, file) => Math.max(max, file.additions + file.deletions), 0),
    [files],
  );

  if (layout.length === 0) {
    return (
      <div aria-hidden="true" className="text-xs text-muted-foreground">
        No files.
      </div>
    );
  }
  const hasActive = activeFiles.size > 0;

  return (
    <div aria-label="Changed file groups" className="flex flex-col gap-8">
      {layout.map((group) => (
        <section className="flex flex-col gap-3" key={group.title}>
          <header className="flex items-center gap-3 px-1">
            <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {group.title}
            </h3>
            <span aria-hidden="true" className="flex-1 border-t border-dashed border-border" />
            <span className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
              {group.files.length}
            </span>
          </header>
          <div className="flex flex-wrap items-start gap-4">
            {group.files.map((file) => (
              <FileMasonryCard
                active={selectedPath === file.filename}
                dimmed={
                  hasActive && !activeFiles.has(file.filename) && selectedPath !== file.filename
                }
                emphasizedRanges={emphasizedRanges[file.filename]}
                file={file}
                key={file.filename}
                maxFileLines={maxFileLines}
                onClick={onSelect}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

const buildGroupLayout = (files: PullRequestFile[], groups: WalkthroughGroup[]): GroupRender[] => {
  const filesByPath = new Map(files.map((file) => [file.filename, file] as const));
  const claimed = new Set<string>();
  const layout: GroupRender[] = [];

  for (const group of groups) {
    const groupFiles: PullRequestFile[] = [];
    for (const path of group.filePaths) {
      const file = filesByPath.get(path);
      if (!file || claimed.has(path)) continue;
      claimed.add(path);
      groupFiles.push(file);
    }
    if (groupFiles.length > 0) {
      layout.push({ files: groupFiles, title: group.title });
    }
  }

  const ungrouped = files.filter((file) => !claimed.has(file.filename));
  if (ungrouped.length > 0) {
    layout.push({ files: ungrouped, isUngrouped: true, title: "Other" });
  }

  if (layout.length === 0 && files.length > 0) {
    layout.push({ files, title: "Files" });
  }

  return layout;
};
