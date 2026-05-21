import {
  memo,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "../../lib/utils";
import { buildWalkthroughLayout } from "./walkthrough-parser";

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
  const [diffsVisible, setDiffsVisible] = useState(showDiffs);
  const layout = useMemo(() => buildWalkthroughLayout(walkthrough), [walkthrough]);
  const deferredDiffs = useDeferredValue(layout.diffs);
  const gridRef = useRef<HTMLDivElement>(null);
  const proseRef = useRef<HTMLDivElement>(null);
  const diffContainerRef = useRef<HTMLDivElement>(null);
  const [anchorLayout, setAnchorLayout] = useState<AnchorLayoutState>({
    minHeight: 0,
    positions: {},
  });

  useEffect(() => {
    if (showDiffs) {
      startTransition(() => setDiffsVisible(true));
    } else {
      setDiffsVisible(false);
    }
  }, [showDiffs]);

  useEffect(() => {
    const gridElement = gridRef.current;
    const proseElement = proseRef.current;
    if (!gridElement || !proseElement || !diffsVisible) {
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
  }, [deferredDiffs, diffsVisible, layout]);

  if (!layout.prose) {
    return (
      <p className="text-sm text-muted-foreground">
        Generate a walkthrough to see the guided walkthrough.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "relative grid items-start",
        diffsVisible && layout.diffs.length > 0
          ? "grid-cols-[minmax(0,65ch)_minmax(0,1fr)] gap-8"
          : "grid-cols-[minmax(0,70ch)]",
      )}
      aria-label="Pull request walkthrough"
      ref={gridRef}
    >
      <div ref={proseRef}>
        <WalkthroughProse markdown={layout.prose} onFileClick={onFileClick} />
      </div>
      {diffsVisible && layout.diffs.length > 0 ? (
        <div
          className="relative"
          ref={diffContainerRef}
          style={{ minHeight: anchorLayout.minHeight }}
        >
          {deferredDiffs.map((diff) => (
            <div
              className="absolute left-0 right-0 flex flex-col gap-1"
              data-diff-id={diff.anchorId}
              key={diff.anchorId}
              style={{ top: anchorLayout.positions[diff.anchorId] ?? 0 }}
            >
              {diff.label ? (
                <p className="text-xs italic text-muted-foreground">{diff.label}</p>
              ) : null}
              <DiffBlock code={diff.code} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

interface AnchorLayoutState {
  minHeight: number;
  positions: Record<string, number>;
}

const DIFF_GAP_PX = 8;
const FALLBACK_DIFF_HEIGHT_PX = 100;

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

const WalkthroughProse = ({
  markdown,
  onFileClick,
}: {
  markdown: string;
  onFileClick?: (path: string) => void;
}): React.JSX.Element => {
  let headingIndex = 0;

  return (
    <article className="flex max-w-[70ch] flex-col gap-3 text-sm leading-7 text-foreground">
      {parseMarkdown(markdown).map((block, index) => {
        if (block.type === "diff-anchor") {
          return (
            <span className="block h-0" data-diff-anchor={block.anchorId} key={block.anchorId} />
          );
        }

        const headingId = block.type === "heading" ? `wt-${headingIndex++}` : undefined;

        return renderMarkdownBlock(block, index, headingId, onFileClick);
      })}
    </article>
  );
};

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
      return <DiffBlock code={block.code} key={index} />;
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

const DiffBlock = memo(({ code }: { code: string }): React.JSX.Element => {
  const lineOccurrences = new Map<string, number>();
  return (
    <pre className="overflow-auto rounded-md border bg-background p-4 font-mono text-xs">
      {code.split("\n").map((line) => {
        const occurrence = lineOccurrences.get(line) ?? 0;
        lineOccurrences.set(line, occurrence + 1);
        let lineClass = "text-foreground";
        if (line.startsWith("+")) lineClass = "text-green-400";
        else if (line.startsWith("-")) lineClass = "text-red-400";
        else if (line.startsWith("@@")) lineClass = "text-blue-400";
        return (
          <div key={`${line}-${occurrence}`} className={lineClass}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
});

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
