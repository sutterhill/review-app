import { useMemo, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { buildWalkthroughSections } from "./walkthrough-parser";

interface WalkthroughViewProps {
  walkthrough: string;
}

export const WalkthroughView = ({ walkthrough }: WalkthroughViewProps): React.JSX.Element => {
  const sections = useMemo(() => buildWalkthroughSections(walkthrough), [walkthrough]);

  if (sections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Generate a walkthrough to see the guided walkthrough.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5" aria-label="Pull request walkthrough">
      {sections.map((section, index) => {
        const headingOffset = sections
          .slice(0, index)
          .reduce((count, previousSection) => count + countHeadings(previousSection.markdown), 0);

        return (
          <WalkthroughMarkdown
            headingOffset={headingOffset}
            key={section.id}
            markdown={section.markdown}
          />
        );
      })}
    </div>
  );
};

const WalkthroughMarkdown = ({
  headingOffset,
  markdown,
}: {
  headingOffset: number;
  markdown: string;
}): React.JSX.Element => {
  let localHeadingIndex = 0;

  return (
    <article className="flex max-w-[70ch] flex-col gap-3 text-sm leading-7 text-foreground">
      {parseMarkdown(markdown).map((block, index) => {
        const headingId =
          block.type === "heading" ? `wt-${headingOffset + localHeadingIndex++}` : undefined;

        return renderMarkdownBlock(block, index, headingId);
      })}
    </article>
  );
};

type MarkdownBlock =
  | { level: number; text: string; type: "heading" }
  | { code: string; language: string; type: "code" }
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

const renderMarkdownBlock = (block: MarkdownBlock, index: number, headingId?: string): ReactNode => {
  if (block.type === "heading") {
    return renderHeading(block.level, block.text, index, headingId);
  }

  if (block.type === "code") {
    if (block.language === "diff") {
      const lineOccurrences = new Map<string, number>();

      return (
        <pre
          className="overflow-auto rounded-md border bg-background p-4 font-mono text-xs"
          key={index}
        >
          {block.code.split("\n").map((line) => {
            const occurrence = lineOccurrences.get(line) ?? 0;
            let lineClass = "text-foreground";
            lineOccurrences.set(line, occurrence + 1);
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

const renderHeading = (level: number, text: string, key: number, id?: string): ReactNode => {
  if (level === 1) {
    return (
      <h2 className="scroll-mt-4 text-xl font-semibold leading-tight text-foreground" id={id} key={key}>
        {renderInlineMarkdown(text)}
      </h2>
    );
  }

  if (level === 2) {
    return (
      <h3 className="scroll-mt-4 text-lg font-semibold leading-tight text-foreground" id={id} key={key}>
        {renderInlineMarkdown(text)}
      </h3>
    );
  }

  return (
    <h4 className="scroll-mt-4 text-base font-semibold leading-tight text-foreground" id={id} key={key}>
      {renderInlineMarkdown(text)}
    </h4>
  );
};

const countHeadings = (markdown: string): number =>
  markdown.split("\n").filter((line) => /^(#{1,4})\s+(.+)$/u.test(line)).length;

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
