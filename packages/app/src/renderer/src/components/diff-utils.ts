import type { PatchDiffProps } from "@pierre/diffs/react";

import type { ParsedDiffFile } from "./DiffView/diff-parser";

type PatchDiffOptions = NonNullable<PatchDiffProps<undefined>["options"]>;

export const DIFF_OPTIONS: PatchDiffOptions = {
  diffIndicators: "classic",
  diffStyle: "unified",
  disableLineNumbers: false,
  hunkSeparators: "line-info",
  overflow: "wrap",
  stickyHeader: true,
  theme: { dark: "github-dark", light: "github-light" },
  themeType: "system",
};

export const SNIPPET_DIFF_OPTIONS: PatchDiffOptions = {
  ...DIFF_OPTIONS,
  stickyHeader: false,
  unsafeCSS: "[data-diffs-header]{display:none!important}",
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
