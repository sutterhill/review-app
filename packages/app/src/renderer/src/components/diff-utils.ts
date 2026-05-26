import type { PatchDiffProps } from "@pierre/diffs/react";

import type { ParsedDiffFile } from "./DiffView/diff-parser";

type PatchDiffOptions = NonNullable<PatchDiffProps<undefined>["options"]>;

const ANNOTATION_CSS = `
[data-diff], [data-file] {
  --diffs-code-grid: var(--diffs-grid-number-column-width) minmax(0, 1fr) !important;
}
[data-annotation-content], [data-annotation-slot] {
  min-width: 0 !important;
  max-width: 100% !important;
  overflow: hidden;
}
[data-separator=line-info],
[data-separator=line-info] [data-separator-content],
[data-additions] [data-gutter] [data-separator=line-info] [data-separator-wrapper],
[data-overflow=wrap] [data-additions] [data-content] [data-separator=line-info] [data-separator-wrapper] {
  background-color: transparent !important;
}
[data-separator=line-info] [data-separator-wrapper] {
  gap: 1ch;
}
[data-separator=line-info]:not([data-expand-index]) [data-separator-wrapper]::before {
  content: "";
  flex: 1 1 auto;
  min-width: 0;
  height: 7px;
  margin-top: 2px;
  margin-left: calc(-1 * var(--diffs-gap-inline, var(--diffs-gap-fallback)));
  background-image: repeating-linear-gradient(
    to bottom,
    var(--border) 0 1px,
    transparent 1px 3px
  );
}
[data-separator=line-info] [data-separator-content] {
  flex: 0 0 auto !important;
}
`;

export const DIFF_OPTIONS: PatchDiffOptions = {
  diffIndicators: "classic",
  diffStyle: "unified",
  disableLineNumbers: false,
  hunkSeparators: "line-info",
  overflow: "wrap",
  stickyHeader: true,
  theme: { dark: "github-dark", light: "github-light" },
  themeType: "system",
  unsafeCSS: ANNOTATION_CSS,
};

export const SNIPPET_DIFF_OPTIONS: PatchDiffOptions = {
  ...DIFF_OPTIONS,
  stickyHeader: false,
  unsafeCSS: `[data-diffs-header]{display:none!important}${ANNOTATION_CSS}`,
};

export const statusLabel = (status: ParsedDiffFile["status"]): string => {
  const labels: Record<ParsedDiffFile["status"], string> = {
    added: "Added",
    deleted: "Deleted",
    modified: "Modified",
    renamed: "Renamed",
  };
  return labels[status];
};

export const statusBadgeVariant = (
  status: ParsedDiffFile["status"],
): "default" | "destructive" | "outline" | "secondary" => {
  const variants: Record<
    ParsedDiffFile["status"],
    "default" | "destructive" | "outline" | "secondary"
  > = {
    added: "default",
    deleted: "destructive",
    modified: "secondary",
    renamed: "outline",
  };
  return variants[status];
};
