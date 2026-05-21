import { useMemo, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { splitIntoChunks, type WalkthroughChunk } from "./walkthrough-parser";

interface WalkthroughViewProps {
  onFileClick?: (path: string) => void;
  walkthrough: string;
}

export const WalkthroughView = ({
  onFileClick,
  walkthrough,
}: WalkthroughViewProps): React.JSX.Element => {
  const allChunks = useMemo(() => splitIntoChunks(walkthrough), [walkthrough]);
  const rows = useMemo(() => buildChunkRows(allChunks), [allChunks]);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Generate a walkthrough to see the guided walkthrough.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5" aria-label="Pull request walkthrough">
      {rows.map((row, index) => {
        const headingOffset = rows
          .slice(0, index)
          .reduce((count, previousRow) => count + countHeadings(previousRow.prose), 0);

        if (row.diffs.length > 0) {
          return (
            <div
              className="grid grid-cols-[minmax(0,65ch)_minmax(0,1fr)] items-start gap-6"
              key={row.id}
            >
              <WalkthroughMarkdown
                headingOffset={headingOffset}
                markdown={row.prose}
                onFileClick={onFileClick}
              />
              <div className="flex flex-col gap-3">
                {row.diffs.map((diff) => (
                  <div
                    className="flex flex-col gap-1"
                    key={`${diff.label ?? "diff"}:${diff.code.slice(0, 40)}`}
                  >
                    {diff.label ? (
                      <p className="text-xs italic text-muted-foreground">{diff.label}</p>
                    ) : null}
                    <DiffBlock code={diff.code} />
                  </div>
                ))}
              </div>
            </div>
          );
        }

        return (
          <WalkthroughMarkdown
            headingOffset={headingOffset}
            key={row.id}
            markdown={row.prose}
            onFileClick={onFileClick}
          />
        );
      })}
    </div>
  );
};

interface ChunkRow {
  diffs: { code: string; label?: string }[];
  id: string;
  prose: string;
}

const buildChunkRows = (chunks: WalkthroughChunk[]): ChunkRow[] => {
  const rows: ChunkRow[] = [];
  let currentProse = "";
  let currentDiffs: { code: string; label?: string }[] = [];

  for (const chunk of chunks) {
    if (chunk.type === "prose") {
      if (currentProse || currentDiffs.length > 0) {
        rows.push(buildChunkRow(currentProse, currentDiffs, rows.length));
        currentDiffs = [];
      }
      currentProse = chunk.markdown;
    } else {
      currentDiffs.push({ code: chunk.code, label: chunk.label });
    }
  }

  if (currentProse || currentDiffs.length > 0) {
    rows.push(buildChunkRow(currentProse, currentDiffs, rows.length));
  }

  return rows;
};

const buildChunkRow = (
  prose: string,
  diffs: { code: string; label?: string }[],
  position: number,
): ChunkRow => ({
  diffs: [...diffs],
  id: `${prose.slice(0, 40)}:${diffs.map((diff) => diff.label ?? diff.code.slice(0, 40)).join("|")}:${position}`,
  prose,
});

const WalkthroughMarkdown = ({
  headingOffset,
  markdown,
  onFileClick,
}: {
  headingOffset: number;
  markdown: string;
  onFileClick?: (path: string) => void;
}): React.JSX.Element => {
  let localHeadingIndex = 0;

  return (
    <article className="flex max-w-[70ch] flex-col gap-3 text-sm leading-7 text-foreground">
      {parseMarkdown(markdown).map((block, index) => {
        const headingId =
          block.type === "heading" ? `wt-${headingOffset + localHeadingIndex++}` : undefined;

        return renderMarkdownBlock(block, index, headingId, onFileClick);
      })}
    </article>
  );
};

type MarkdownBlock =
  | { level: number; text: string; type: "heading" }
  | { code: string; language: string; type: "code" }
  | { type: "hr" }
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

    const heading = line.match(/^(#{1,4})\s+(.+)$/u);
    const listItem = line.match(/^(?:[-*]|([0-9]+)[.)])\s+(.+)$/u);

    if (heading) {
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

const countHeadings = (markdown: string): number =>
  markdown.split("\n").filter((line) => /^(#{1,4})\s+(.+)$/u.test(line)).length;

const DiffBlock = ({ code }: { code: string }): React.JSX.Element => {
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
