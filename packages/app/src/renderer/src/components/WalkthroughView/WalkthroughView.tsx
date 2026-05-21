import { PatchDiff, WorkerPoolContextProvider, type PatchDiffProps } from "@pierre/diffs/react";
import { memo, startTransition, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import { DIFF_OPTIONS } from "../diff-utils";
import { buildWalkthroughLayout } from "./walkthrough-parser";

type PatchDiffOptions = NonNullable<PatchDiffProps<undefined>["options"]>;

const WALKTHROUGH_DIFF_OPTIONS: PatchDiffOptions = {
  ...DIFF_OPTIONS,
  disableFileHeader: true,
  stickyHeader: false,
};

const DIFF_WORKER_POOL_OPTIONS = {
  poolSize: 2,
  totalASTLRUCacheSize: 200,
  workerFactory: (): Worker =>
    new Worker(new URL("@pierre/diffs/worker/worker.js", import.meta.url), { type: "module" }),
};

const DIFF_HIGHLIGHTER_OPTIONS = {
  maxLineDiffLength: 1000,
  theme: DIFF_OPTIONS.theme,
  tokenizeMaxLineLength: 1000,
};

const WIDE_LAYOUT_QUERY = "(min-width: 1024px)";

interface WalkthroughViewProps {
  onFileClick?: (path: string) => void;
  showDiffs?: boolean;
  walkthrough: string;
}

export const WalkthroughView = ({
  onFileClick,
  showDiffs = true,
  walkthrough,
}: WalkthroughViewProps): React.JSX.Element => {
  const [visibleDiffCount, setVisibleDiffCount] = useState(0);
  const [isWideLayout, setIsWideLayout] = useState(() => getIsWideLayout());
  const layout = useMemo(() => buildWalkthroughLayout(walkthrough), [walkthrough]);
  const visibleDiffs = useMemo(
    () => layout.diffs.slice(0, visibleDiffCount),
    [layout.diffs, visibleDiffCount],
  );
  const inlineDiffs = useMemo(
    () =>
      !isWideLayout && showDiffs
        ? new Map(
            visibleDiffs
              .filter((diff) => hasMeaningfulDiffContent(diff.code) || diff.label)
              .map((diff) => [diff.anchorId, { code: diff.code, label: diff.label }]),
          )
        : undefined,
    [isWideLayout, showDiffs, visibleDiffs],
  );
  const gridRef = useRef<HTMLDivElement>(null);
  const proseRef = useRef<HTMLDivElement>(null);
  const diffContainerRef = useRef<HTMLDivElement>(null);
  const [anchorLayout, setAnchorLayout] = useState<AnchorLayoutState>({
    minHeight: 0,
    positions: {},
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(WIDE_LAYOUT_QUERY);
    const handleChange = (event: MediaQueryListEvent): void => setIsWideLayout(event.matches);

    setIsWideLayout(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    setVisibleDiffCount(0);

    if (!showDiffs || layout.diffs.length === 0) {
      return;
    }

    let isCancelled = false;
    let count = 0;
    let frameId: number | undefined;
    let nextFrameId: number | undefined;

    const showNextDiff = (): void => {
      if (isCancelled || count >= layout.diffs.length) {
        return;
      }

      count += 1;
      startTransition(() => setVisibleDiffCount(count));

      frameId = requestAnimationFrame(() => {
        nextFrameId = requestAnimationFrame(showNextDiff);
      });
    };

    frameId = requestAnimationFrame(showNextDiff);

    return () => {
      isCancelled = true;
      if (frameId !== undefined) cancelAnimationFrame(frameId);
      if (nextFrameId !== undefined) cancelAnimationFrame(nextFrameId);
    };
  }, [layout.diffs, showDiffs]);

  const shouldShowDiffs = showDiffs && layout.diffs.length > 0;
  const diffsVisible = visibleDiffs.length > 0;
  const anchoredDiffsVisible = shouldShowDiffs && isWideLayout && diffsVisible;

  useEffect(() => {
    if (!isWideLayout || !diffsVisible) {
      setAnchorLayout({ minHeight: 0, positions: {} });
    }
  }, [diffsVisible, isWideLayout]);

  useEffect(() => {
    const gridElement = gridRef.current;
    const proseElement = proseRef.current;
    if (!gridElement || !proseElement || !anchoredDiffsVisible) {
      return;
    }

    const measureAnchors = (): void => {
      const positions = measureDiffPositions(gridElement, proseElement, diffContainerRef.current);
      setAnchorLayout((previous) =>
        isSameAnchorLayout(previous, positions) ? previous : positions,
      );
    };

    measureAnchors();

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measureAnchors);
    resizeObserver?.observe(proseElement);
    if (diffContainerRef.current) {
      resizeObserver?.observe(diffContainerRef.current);
    }
    window.addEventListener("resize", measureAnchors);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measureAnchors);
    };
  }, [anchoredDiffsVisible, layout, visibleDiffs]);

  if (!layout.prose) {
    return (
      <p className="text-sm text-muted-foreground">
        Generate a walkthrough to see the guided walkthrough.
      </p>
    );
  }

  return (
    <WorkerPoolContextProvider
      highlighterOptions={DIFF_HIGHLIGHTER_OPTIONS}
      poolOptions={DIFF_WORKER_POOL_OPTIONS}
    >
      <div
        className={cn(
          "relative grid items-start",
          shouldShowDiffs && isWideLayout
            ? "grid-cols-[minmax(0,65ch)_minmax(0,1fr)] gap-8"
            : "grid-cols-[minmax(0,70ch)]",
        )}
        aria-label="Pull request walkthrough"
        ref={gridRef}
      >
        <div ref={proseRef}>
          <WalkthroughProse
            inlineDiffs={inlineDiffs}
            markdown={layout.prose}
            onFileClick={onFileClick}
          />
        </div>
        {shouldShowDiffs && isWideLayout ? (
          <div
            className="relative"
            ref={diffContainerRef}
            style={{ minHeight: anchorLayout.minHeight }}
          >
            {visibleDiffs.map((diff) => {
              const hasDiff = hasMeaningfulDiffContent(diff.code);
              if (!hasDiff && !diff.label) {
                return null;
              }

              return (
                <div
                  className="absolute left-0 right-0 flex flex-col gap-1"
                  data-diff-id={diff.anchorId}
                  key={diff.anchorId}
                  style={{ top: anchorLayout.positions[diff.anchorId] ?? 0 }}
                >
                  {diff.label ? (
                    <p className="text-xs italic text-muted-foreground">{diff.label}</p>
                  ) : null}
                  {hasDiff ? <DiffBlock code={diff.code} label={diff.label} /> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </WorkerPoolContextProvider>
  );
};

interface AnchorLayoutState {
  minHeight: number;
  positions: Record<string, number>;
}

interface InlineDiff {
  code: string;
  label?: string;
}

const DIFF_GAP_PX = 8;
const FALLBACK_DIFF_HEIGHT_PX = 100;

const getIsWideLayout = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(WIDE_LAYOUT_QUERY).matches;

const measureDiffPositions = (
  gridElement: HTMLElement,
  proseElement: HTMLElement,
  diffContainerElement: HTMLElement | null,
): AnchorLayoutState => {
  const gridTop = gridElement.getBoundingClientRect().top;
  const rawPositions = [...proseElement.querySelectorAll<HTMLElement>("[data-diff-anchor]")].map(
    (element) => ({
      id: element.getAttribute("data-diff-anchor") ?? "",
      top: element.getBoundingClientRect().top - gridTop,
    }),
  );
  const positions: Record<string, number> = {};
  let lastBottom: number | null = null;

  for (const { id, top } of rawPositions) {
    if (!id) {
      continue;
    }
    const adjustedTop: number = lastBottom === null ? top : Math.max(top, lastBottom + DIFF_GAP_PX);
    const diffElement = diffContainerElement?.querySelector<HTMLElement>(`[data-diff-id="${id}"]`);
    const height = diffElement?.getBoundingClientRect().height ?? FALLBACK_DIFF_HEIGHT_PX;
    positions[id] = adjustedTop;
    lastBottom = adjustedTop + height;
  }

  return {
    minHeight: Math.max(proseElement.getBoundingClientRect().height, lastBottom ?? 0),
    positions,
  };
};

const isSameAnchorLayout = (current: AnchorLayoutState, next: AnchorLayoutState): boolean => {
  if (current.minHeight !== next.minHeight) {
    return false;
  }

  const currentKeys = Object.keys(current.positions);
  const nextKeys = Object.keys(next.positions);
  return (
    currentKeys.length === nextKeys.length &&
    nextKeys.every((key) => current.positions[key] === next.positions[key])
  );
};

const WalkthroughProse = memo(function WalkthroughProse({
  inlineDiffs,
  markdown,
  onFileClick,
}: {
  inlineDiffs?: Map<string, InlineDiff>;
  markdown: string;
  onFileClick?: (path: string) => void;
}): React.JSX.Element {
  const blocks = useMemo(() => parseMarkdown(markdown), [markdown]);
  let headingIndex = 0;

  return (
    <article className="flex max-w-[70ch] flex-col gap-3 text-sm leading-7 text-foreground">
      {blocks.map((block, index) => {
        if (block.type === "diff-anchor") {
          const inlineDiff = inlineDiffs?.get(block.anchorId);

          if (inlineDiffs) {
            const hasDiff = inlineDiff ? hasMeaningfulDiffContent(inlineDiff.code) : false;

            return inlineDiff ? (
              <div className="flex flex-col gap-1" key={block.anchorId}>
                {inlineDiff.label ? (
                  <p className="text-xs italic leading-normal text-muted-foreground">
                    {inlineDiff.label}
                  </p>
                ) : null}
                {hasDiff ? <DiffBlock code={inlineDiff.code} label={inlineDiff.label} /> : null}
              </div>
            ) : null;
          }

          return (
            <span className="block h-0" data-diff-anchor={block.anchorId} key={block.anchorId} />
          );
        }

        const headingId = block.type === "heading" ? `wt-${headingIndex++}` : undefined;

        return renderMarkdownBlock(block, index, headingId, onFileClick);
      })}
    </article>
  );
});

type MarkdownBlock =
  | { level: number; text: string; type: "heading" }
  | { code: string; language: string; type: "code" }
  | { type: "hr" }
  | { anchorId: string; type: "diff-anchor" }
  | { ordered: boolean; items: string[]; type: "list" }
  | { text: string; type: "paragraph" };

const parseMarkdown = (markdown: string): MarkdownBlock[] => {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.split("\n");
  const paragraph: string[] = [];
  const listItems: string[] = [];
  let orderedList = false;
  let codeLines: string[] | null = null;
  let codeLang = "";

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
        blocks.push({ code: codeLines.join("\n"), language: codeLang, type: "code" });
        codeLines = null;
        codeLang = "";
      } else {
        flushParagraph();
        flushList();
        codeLines = [];
        codeLang = line.trim().slice(3).trim().toLowerCase();
      }
      continue;
    }

    if (codeLines !== null) {
      codeLines.push(line);
      continue;
    }

    const anchor = line.trim().match(/^<<DIFF_ANCHOR:(.+)>>$/u);
    const heading = line.match(/^(#{1,4})\s+(.+)$/u);
    const listItem = line.match(/^(?:[-*]|([0-9]+)[.)])\s+(.+)$/u);

    if (anchor) {
      flushParagraph();
      flushList();
      blocks.push({ anchorId: anchor[1] ?? "", type: "diff-anchor" });
    } else if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ level: heading[1]?.length ?? 1, text: heading[2] ?? "", type: "heading" });
    } else if (/^[-*_]{3,}$/u.test(line.trim())) {
      flushParagraph();
      flushList();
      blocks.push({ type: "hr" });
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
    blocks.push({ code: codeLines.join("\n"), language: codeLang, type: "code" });
  }

  return blocks;
};

const renderMarkdownBlock = (
  block: MarkdownBlock,
  index: number,
  headingId?: string,
  onFileClick?: (path: string) => void,
): ReactNode => {
  if (block.type === "heading") {
    return renderHeading(block.level, block.text, index, headingId, onFileClick);
  }

  if (block.type === "code") {
    if (block.language === "diff") {
      return hasMeaningfulDiffContent(block.code) ? (
        <DiffBlock code={block.code} key={index} />
      ) : null;
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

  if (block.type === "hr") {
    return <hr className="border-border" key={index} />;
  }

  if (block.type === "diff-anchor") {
    return null;
  }

  if (block.type === "list") {
    const ListTag = block.ordered ? "ol" : "ul";
    return (
      <ListTag
        className={cn("flex flex-col gap-1 pl-5", block.ordered ? "list-decimal" : "list-disc")}
        key={index}
      >
        {block.items.map((item) => (
          <li key={item}>{renderInlineMarkdown(item, onFileClick)}</li>
        ))}
      </ListTag>
    );
  }

  return <p key={index}>{renderInlineMarkdown(block.text, onFileClick)}</p>;
};

const renderHeading = (
  level: number,
  text: string,
  key: number,
  id?: string,
  onFileClick?: (path: string) => void,
): ReactNode => {
  if (level === 1) {
    return (
      <h2
        className="scroll-mt-4 text-xl font-semibold leading-tight text-foreground"
        id={id}
        key={key}
      >
        {renderInlineMarkdown(text, onFileClick)}
      </h2>
    );
  }

  if (level === 2) {
    return (
      <h3
        className="scroll-mt-4 text-lg font-semibold leading-tight text-foreground"
        id={id}
        key={key}
      >
        {renderInlineMarkdown(text, onFileClick)}
      </h3>
    );
  }

  return (
    <h4
      className="scroll-mt-4 text-base font-semibold leading-tight text-foreground"
      id={id}
      key={key}
    >
      {renderInlineMarkdown(text, onFileClick)}
    </h4>
  );
};

const DiffBlock = memo(
  ({ code, label }: { code: string; label?: string }): React.JSX.Element => (
    <PatchDiff
      className="block overflow-hidden rounded-md border bg-background text-xs"
      options={WALKTHROUGH_DIFF_OPTIONS}
      patch={buildPatchForDiffBlock(code, label)}
    />
  ),
);

export const hasMeaningfulDiffContent = (code: string): boolean =>
  code.split("\n").some((line) => {
    const trimmed = line.trim();
    return (
      (trimmed.startsWith("+") && !trimmed.startsWith("+++")) ||
      (trimmed.startsWith("-") && !trimmed.startsWith("---"))
    );
  });

const buildPatchForDiffBlock = (code: string, label?: string): string => {
  const trimmedCode = code.trimEnd();
  if (/^(?:diff --git |---\s+)/mu.test(trimmedCode)) {
    return trimmedCode;
  }

  const fileName = normalizeDiffFileName(label);
  return [
    `--- a/${fileName}`,
    `+++ b/${fileName}`,
    buildSyntheticHunkHeader(trimmedCode),
    trimmedCode,
  ]
    .filter(Boolean)
    .join("\n");
};

const normalizeDiffFileName = (label?: string): string => {
  const fileName = label?.replace(/^a\//u, "").replace(/^b\//u, "").trim();
  return fileName && !/\s/u.test(fileName) ? fileName : "walkthrough.diff";
};

const buildSyntheticHunkHeader = (code: string): string => {
  const lines = code.length > 0 ? code.split("\n") : [];
  const deletionLines = lines.filter((line) => line.startsWith("-") && !line.startsWith("---"));
  const additionLines = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++"));
  const contextLines = lines.length - deletionLines.length - additionLines.length;
  const oldLineCount = Math.max(1, deletionLines.length + contextLines);
  const newLineCount = Math.max(1, additionLines.length + contextLines);
  return `@@ -1,${oldLineCount} +1,${newLineCount} @@`;
};

const renderInlineMarkdown = (text: string, onFileClick?: (path: string) => void): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const codePattern = /`([^`]+)`/gu;
  let lastIndex = 0;

  for (const match of text.matchAll(codePattern)) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const codeText = match[1] ?? "";
    if (isFilePathReference(codeText)) {
      nodes.push(
        <a
          className="cursor-pointer rounded-md border bg-background px-1 py-0.5 font-mono text-[0.9em] text-primary underline-offset-2 hover:underline"
          href="../diff"
          key={`${match.index}-${codeText}`}
          onClick={(event) => {
            event.preventDefault();
            onFileClick?.(codeText);
          }}
        >
          {codeText}
        </a>,
      );
    } else {
      nodes.push(
        <code
          className="rounded-md border bg-background px-1 py-0.5 font-mono text-[0.9em] text-foreground"
          key={`${match.index}-${codeText}`}
        >
          {codeText}
        </code>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

const isFilePathReference = (text: string): boolean =>
  text.includes("/") || /\.(?:css|go|js|json|jsx|py|rs|ts|tsx)$/u.test(text);
