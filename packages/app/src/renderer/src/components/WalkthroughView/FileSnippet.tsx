import { PatchDiff } from "@pierre/diffs/react";
import { useMemo, useState } from "react";

import type { LineRange } from "../../store/walkthrough/walkthrough-types";
import { DIFF_OPTIONS } from "../diff-utils";
import { buildSnippetPatch } from "./build-snippet-patch";
import { extractSnippet } from "./extract-snippet";

interface FileSnippetProps {
  lineRanges: LineRange[];
  onClick: () => void;
  patch: string;
  path: string;
}

const SNIPPET_MAX_LINES = 5;

const SNIPPET_DIFF_OPTIONS = {
  ...DIFF_OPTIONS,
  disableFileHeader: true,
  disableLineNumbers: true,
  hunkSeparators: "metadata" as const,
  overflow: "scroll" as const,
  stickyHeader: false,
};

const COLLAPSED_MAX_HEIGHT_PX = 5 * 18;

export const FileSnippet = ({
  lineRanges,
  onClick,
  patch,
  path,
}: FileSnippetProps): React.JSX.Element => {
  const snippetLines = useMemo(() => extractSnippet(patch, lineRanges), [patch, lineRanges]);
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = Math.max(0, snippetLines.length - SNIPPET_MAX_LINES);
  const snippetPatch = useMemo(() => buildSnippetPatch(path, snippetLines), [path, snippetLines]);
  const fileName = path.split("/").pop() ?? path;
  const isCollapsed = !expanded && hiddenCount > 0;

  return (
    <div className="flex w-full flex-col gap-1.5">
      <button
        aria-label={`Open ${path}`}
        className="w-fit cursor-pointer text-left text-[0.78rem] font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        onClick={onClick}
        type="button"
      >
        {fileName}
      </button>
      {snippetPatch ? (
        <div className="overflow-hidden rounded-md border border-border/60 bg-background text-[0.72rem] leading-[1.55]">
          <div
            className="overflow-hidden"
            style={isCollapsed ? { maxHeight: COLLAPSED_MAX_HEIGHT_PX } : undefined}
          >
            <PatchDiff options={SNIPPET_DIFF_OPTIONS} patch={snippetPatch} />
          </div>
          {hiddenCount > 0 ? (
            <button
              className="block w-full cursor-pointer border-t border-border/60 bg-muted/40 px-3 py-1.5 text-left text-[0.72rem] font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              onClick={() => setExpanded((value) => !value)}
              type="button"
            >
              {expanded
                ? "Show less"
                : `Show ${hiddenCount} more line${hiddenCount === 1 ? "" : "s"}`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
