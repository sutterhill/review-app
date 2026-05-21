import { PatchDiff } from "@pierre/diffs/react";
import type { ReactNode } from "react";
import { Fragment, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type { PullRequestData } from "../../store/pr/pr-types";
import { DIFF_OPTIONS, statusBadgeVariant, statusLabel, usePreloadedPatches } from "../diff-utils";
import { parseUnifiedDiff, type ParsedDiffFile } from "../DiffView";
import { buildNarrativeSections, shouldCollapseDiffSection } from "./narrative-parser";

interface NarrativeViewProps {
  narrative: string;
  onFileElement?: (path: string, element: HTMLElement | null) => void;
  pullRequest: PullRequestData;
}

export const NarrativeView = ({
  narrative,
  onFileElement,
  pullRequest,
}: NarrativeViewProps): React.JSX.Element => {
  const files = useMemo(
    () => parseUnifiedDiff(pullRequest.diff, pullRequest.files),
    [pullRequest.diff, pullRequest.files],
  );
  const fileByPath = useMemo(() => new Map(files.map((file) => [file.path, file])), [files]);
  const sections = useMemo(() => buildNarrativeSections(narrative, files), [files, narrative]);
  const preloadedHtml = usePreloadedPatches(files);
  const [expandedByPath, setExpandedByPath] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedByPath({});
  }, [pullRequest.diff, pullRequest.metadata.reference]);

  const toggleFile = (path: string): void => {
    const file = fileByPath.get(path);
    setExpandedByPath((current) => {
      const currentExpanded = current[path] ?? (file ? !shouldCollapseDiffSection(file) : true);
      return { ...current, [path]: !currentExpanded };
    });
  };

  if (sections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Generate a narrative to see the guided walkthrough.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5" aria-label="Narrative walkthrough">
      {sections.map((section) => (
        <Fragment key={section.id}>
          <NarrativeMarkdown markdown={section.markdown} subtle={section.isFallback} />
          {section.filePaths.map((path) => {
            const file = fileByPath.get(path);
            return file ? (
              <NarrativeDiffSection
                expanded={expandedByPath[path] ?? !shouldCollapseDiffSection(file)}
                file={file}
                isFormattingOnly={shouldCollapseDiffSection(file)}
                key={path}
                onFileElement={onFileElement}
                onToggle={() => toggleFile(path)}
                preloadedHtml={preloadedHtml[path]}
              />
            ) : null;
          })}
        </Fragment>
      ))}
    </div>
  );
};

interface NarrativeDiffSectionProps {
  expanded: boolean;
  file: ParsedDiffFile;
  isFormattingOnly: boolean;
  onFileElement?: (path: string, element: HTMLElement | null) => void;
  onToggle: () => void;
  preloadedHtml?: string;
}

const NarrativeDiffSection = ({
  expanded,
  file,
  isFormattingOnly,
  onFileElement,
  onToggle,
  preloadedHtml,
}: NarrativeDiffSectionProps): React.JSX.Element => (
  <section
    className={cn(
      "scroll-mt-4 overflow-hidden rounded-lg border bg-background",
      isFormattingOnly && "opacity-80",
    )}
    data-change-status={file.status}
    ref={(element) => onFileElement?.(file.path, element)}
  >
    <header className="flex items-center justify-between gap-4 bg-muted px-4 py-3">
      <div className="min-w-0">
        <Badge variant={statusBadgeVariant(file.status)}>{statusLabel(file.status)}</Badge>
        <h3 className="mt-2 break-all font-mono text-sm leading-snug text-foreground">
          {file.path}
        </h3>
        {file.previousPath ? (
          <p className="mt-1 break-all text-xs text-muted-foreground">
            Renamed from {file.previousPath}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {isFormattingOnly ? <Badge variant="outline">Formatting</Badge> : null}
        <div className="flex items-center gap-2" aria-label="File change counts">
          <Badge variant="secondary">+{file.additions}</Badge>
          <Badge variant="destructive">-{file.deletions}</Badge>
        </div>
        <Button
          aria-expanded={expanded}
          onClick={onToggle}
          size="xs"
          type="button"
          variant="outline"
        >
          {expanded ? "Collapse" : "Expand"}
        </Button>
      </div>
    </header>
    <Separator />
    {expanded ? (
      file.patch ? (
        <PatchDiff
          disableWorkerPool={true}
          options={DIFF_OPTIONS}
          patch={file.patch}
          prerenderedHTML={preloadedHtml}
        />
      ) : (
        <p className="p-4 text-sm text-muted-foreground">
          No textual diff is available for this file.
        </p>
      )
    ) : (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        {isFormattingOnly
          ? "Collapsed because this looks like formatting noise."
          : "Diff collapsed."}
      </p>
    )}
  </section>
);

const NarrativeMarkdown = ({
  markdown,
  subtle,
}: {
  markdown: string;
  subtle: boolean;
}): React.JSX.Element => (
  <article
    className={cn(
      "flex max-w-[70ch] flex-col gap-3 text-sm leading-7 text-foreground",
      subtle && "text-muted-foreground",
    )}
  >
    {parseMarkdown(markdown).map((block, index) => renderMarkdownBlock(block, index))}
  </article>
);

type MarkdownBlock =
  | { level: number; text: string; type: "heading" }
  | { code: string; type: "code" }
  | { ordered: boolean; items: string[]; type: "list" }
  | { text: string; type: "paragraph" };

const parseMarkdown = (markdown: string): MarkdownBlock[] => {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.split("\n");
  const paragraph: string[] = [];
  const listItems: string[] = [];
  let orderedList = false;
  let codeLines: string[] | null = null;

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      blocks.push({ text: paragraph.join(" "), type: "paragraph" });
      paragraph.length = 0;
    }
  };
  const flushList = (): void => {
    if (listItems.length > 0) {
      blocks.push({ items: [...listItems], ordered: orderedList, type: "list" });
      listItems.length = 0;
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (codeLines !== null) {
        blocks.push({ code: codeLines.join("\n"), type: "code" });
        codeLines = null;
      } else {
        flushParagraph();
        flushList();
        codeLines = [];
      }
      continue;
    }

    if (codeLines !== null) {
      codeLines.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/u);
    const listItem = line.match(/^(?:[-*]|([0-9]+)[.)])\s+(.+)$/u);

    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ level: heading[1]?.length ?? 1, text: heading[2] ?? "", type: "heading" });
    } else if (listItem) {
      flushParagraph();
      orderedList = Boolean(listItem[1]);
      listItems.push(listItem[2] ?? "");
    } else if (line.trim().length === 0) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }

  flushParagraph();
  flushList();
  if (codeLines !== null) {
    blocks.push({ code: codeLines.join("\n"), type: "code" });
  }

  return blocks;
};

const looksLikePatch = (code: string): boolean => {
  const lines = code.split("\n");
  if (lines.some((line) => line.startsWith("@@ "))) return true;
  const plusLines = lines.filter((line) => line.startsWith("+")).length;
  const minusLines = lines.filter((line) => line.startsWith("-")).length;
  return plusLines >= 2 && minusLines >= 2;
};

const renderMarkdownBlock = (block: MarkdownBlock, index: number): ReactNode => {
  if (block.type === "heading") {
    return renderHeading(block.level, block.text, index);
  }

  if (block.type === "code") {
    if (looksLikePatch(block.code)) {
      return (
        <div className="overflow-hidden rounded-md border" key={index}>
          <PatchDiff disableWorkerPool={true} options={DIFF_OPTIONS} patch={block.code} />
        </div>
      );
    }

    return (
      <pre
        className="overflow-auto rounded-md border bg-background p-4 text-xs text-foreground"
        key={index}
      >
        <code className="font-mono">{block.code}</code>
      </pre>
    );
  }

  if (block.type === "list") {
    const ListTag = block.ordered ? "ol" : "ul";
    return (
      <ListTag
        className={cn("flex flex-col gap-1 pl-5", block.ordered ? "list-decimal" : "list-disc")}
        key={index}
      >
        {block.items.map((item) => (
          <li key={item}>{renderInlineMarkdown(item)}</li>
        ))}
      </ListTag>
    );
  }

  return <p key={index}>{renderInlineMarkdown(block.text)}</p>;
};

const renderHeading = (level: number, text: string, key: number): ReactNode => {
  if (level === 1) {
    return (
      <h2 className="text-xl font-semibold leading-tight text-foreground" key={key}>
        {renderInlineMarkdown(text)}
      </h2>
    );
  }

  if (level === 2) {
    return (
      <h3 className="text-lg font-semibold leading-tight text-foreground" key={key}>
        {renderInlineMarkdown(text)}
      </h3>
    );
  }

  return (
    <h4 className="text-base font-semibold leading-tight text-foreground" key={key}>
      {renderInlineMarkdown(text)}
    </h4>
  );
};

const renderInlineMarkdown = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const codePattern = /`([^`]+)`/gu;
  let lastIndex = 0;

  for (const match of text.matchAll(codePattern)) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    nodes.push(
      <code
        className="rounded-md border bg-background px-1 py-0.5 font-mono text-[0.9em] text-foreground"
        key={`${match.index}-${match[1]}`}
      >
        {match[1]}
      </code>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};
