import { PatchDiff } from "@pierre/diffs/react";
import { useMemo } from "react";

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

const SNIPPET_DIFF_OPTIONS = {
  ...DIFF_OPTIONS,
  disableLineNumbers: true,
  hunkSeparators: "metadata" as const,
  stickyHeader: false,
};

export const FileSnippet = ({
  lineRanges,
  onClick,
  patch,
  path,
}: FileSnippetProps): React.JSX.Element => {
  const snippetLines = useMemo(() => extractSnippet(patch, lineRanges), [patch, lineRanges]);
  const snippetPatch = useMemo(() => buildSnippetPatch(path, snippetLines), [path, snippetLines]);
  const fileName = path.split("/").pop() ?? path;

  return (
    <button
      aria-label={`Open ${path}`}
      className="group flex w-full cursor-pointer flex-col gap-1.5 text-left"
      onClick={onClick}
      type="button"
    >
      <span className="text-[0.78rem] font-medium text-foreground group-hover:underline">
        {fileName}
      </span>
      {snippetPatch ? (
        <div className="overflow-hidden rounded-md border border-border/60 bg-background text-[0.72rem] leading-[1.55]">
          <PatchDiff options={SNIPPET_DIFF_OPTIONS} patch={snippetPatch} />
        </div>
      ) : null}
    </button>
  );
};
