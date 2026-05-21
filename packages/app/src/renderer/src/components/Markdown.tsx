import type { ReactNode } from "react";

import { cn } from "../lib/utils";

interface MarkdownProps {
  className?: string;
  content: string;
}

type MarkdownBlock =
  | { level: number; text: string; type: "heading" }
  | { code: string; language: string; type: "code" }
  | { type: "hr" }
  | { ordered: boolean; items: string[]; type: "list" }
  | { text: string; type: "blockquote" }
  | { text: string; type: "paragraph" };

export const Markdown = ({ className, content }: MarkdownProps): React.JSX.Element => (
  <article className={cn("flex max-w-[70ch] flex-col gap-3 text-sm leading-7", className)}>
    {parseMarkdown(content.trim()).map(renderMarkdownBlock)}
  </article>
);

const parseMarkdown = (markdown: string): MarkdownBlock[] => {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.split("\n");
  const paragraph: string[] = [];
  const listItems: string[] = [];
  const quoteLines: string[] = [];
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
  const flushBlockquote = (): void => {
    if (quoteLines.length > 0) {
      blocks.push({ text: quoteLines.join(" "), type: "blockquote" });
      quoteLines.length = 0;
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
        flushBlockquote();
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
    const blockquote = line.match(/^>\s?(.*)$/u);

    if (heading) {
      flushParagraph();
      flushList();
      flushBlockquote();
      blocks.push({ level: heading[1]?.length ?? 1, text: heading[2] ?? "", type: "heading" });
    } else if (/^[-*_]{3,}$/u.test(line.trim())) {
      flushParagraph();
      flushList();
      flushBlockquote();
      blocks.push({ type: "hr" });
    } else if (listItem) {
      flushParagraph();
      flushBlockquote();
      const isOrdered = Boolean(listItem[1]);
      if (listItems.length > 0 && orderedList !== isOrdered) {
        flushList();
      }
      orderedList = isOrdered;
      listItems.push(listItem[2] ?? "");
    } else if (blockquote) {
      flushParagraph();
      flushList();
      quoteLines.push(blockquote[1] ?? "");
    } else if (line.trim().length === 0) {
      flushParagraph();
      flushList();
      flushBlockquote();
    } else {
      flushList();
      flushBlockquote();
      paragraph.push(line.trim());
    }
  }

  flushParagraph();
  flushList();
  flushBlockquote();
  if (codeLines !== null) {
    blocks.push({ code: codeLines.join("\n"), language: codeLang, type: "code" });
  }

  return blocks;
};

const renderMarkdownBlock = (block: MarkdownBlock, index: number): ReactNode => {
  if (block.type === "heading") {
    return renderHeading(block.level, block.text, index);
  }

  if (block.type === "code") {
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
    const itemOccurrences = new Map<string, number>();
    return (
      <ListTag
        className={cn("flex flex-col gap-1 pl-5", block.ordered ? "list-decimal" : "list-disc")}
        key={index}
      >
        {block.items.map((item) => {
          const occurrence = itemOccurrences.get(item) ?? 0;
          itemOccurrences.set(item, occurrence + 1);
          return <li key={`${item}-${occurrence}`}>{renderInlineMarkdown(item)}</li>;
        })}
      </ListTag>
    );
  }

  if (block.type === "blockquote") {
    return (
      <blockquote
        className="border-l-2 border-border pl-4 italic text-muted-foreground"
        key={index}
      >
        {renderInlineMarkdown(block.text)}
      </blockquote>
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
  const inlinePattern =
    /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_/gu;
  let lastIndex = 0;

  for (const match of text.matchAll(inlinePattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }

    const codeText = match[1];
    const linkText = match[2];
    const linkUrl = match[3];
    const boldText = match[4] ?? match[5];
    const italicText = match[6] ?? match[7];

    if (codeText !== undefined) {
      nodes.push(
        <code
          className="rounded-md border bg-background px-1 py-0.5 font-mono text-[0.9em] text-foreground"
          key={`${index}-code`}
        >
          {codeText}
        </code>,
      );
    } else if (linkText !== undefined && linkUrl !== undefined) {
      nodes.push(
        <a
          className="text-primary underline underline-offset-2 hover:text-primary/80"
          href={linkUrl}
          key={`${index}-link`}
          rel="noopener noreferrer"
          target="_blank"
        >
          {linkText}
        </a>,
      );
    } else if (boldText !== undefined) {
      nodes.push(<strong key={`${index}-bold`}>{renderInlineMarkdown(boldText)}</strong>);
    } else if (italicText !== undefined) {
      nodes.push(<em key={`${index}-italic`}>{renderInlineMarkdown(italicText)}</em>);
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};
