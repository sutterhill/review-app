import type { PatchDiffProps } from "@pierre/diffs/react";
import { preloadPatchDiff } from "@pierre/diffs/ssr";
import { useEffect, useState } from "react";

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

export const usePreloadedPatches = (files: ParsedDiffFile[]): Record<string, string> => {
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
