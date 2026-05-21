import { useMemo } from "react";

import { cn } from "@/lib/utils";

import type {
  LineRange,
  WalkthroughStep as WalkthroughStepData,
} from "../../store/walkthrough/walkthrough-types";
import { parseInlineFormatting, type InlineToken } from "./inline-formatting";
import { parseInlineNodes } from "./inline-refs";
import { parseBlocks, type Block, type TableAlign } from "./markdown-blocks";
import { MermaidDiagram } from "./MermaidDiagram";
import { normalizeLineRanges } from "./normalize-line-ranges";

interface WalkthroughStepProps {
  index: number;
  isActive: boolean;
  onRefClick: (path: string, lineRanges: LineRange[]) => void;
  step: WalkthroughStepData;
}

export const WalkthroughStep = ({
  index,
  onRefClick,
  step,
}: WalkthroughStepProps): React.JSX.Element => {
  const blocks = useMemo(() => parseBlocks(step.body ?? ""), [step.body]);
  const headingId = `walkthrough-step-${index}`;

  return (
    <section
      aria-labelledby={headingId}
      className="scroll-mt-6 flex flex-col gap-4"
      data-step-index={index}
    >
      <h3
        className="flex flex-col gap-1.5 text-lg font-semibold leading-tight text-foreground"
        id={headingId}
      >
        <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span>{step.heading}</span>
      </h3>
      <div className="flex flex-col gap-4 text-[1.02rem] font-light leading-[1.55] text-foreground">
        {blocks.map((block) => (
          <BlockRenderer block={block} key={blockKey(block)} onRefClick={onRefClick} />
        ))}
      </div>
    </section>
  );
};

interface InlineRendererProps {
  onRefClick: (path: string, lineRanges: LineRange[]) => void;
  text: string;
}

const BlockRenderer = ({
  block,
  onRefClick,
}: {
  block: Block;
  onRefClick: (path: string, lineRanges: LineRange[]) => void;
}): React.JSX.Element => {
  if (block.type === "paragraph") {
    return (
      <p>
        <InlineText onRefClick={onRefClick} text={block.text} />
      </p>
    );
  }
  if (block.type === "list") {
    const ListTag = block.ordered ? "ol" : "ul";
    return (
      <ListTag
        className={cn(
          "ml-5 flex flex-col gap-1.5",
          block.ordered ? "list-decimal" : "list-disc",
          "marker:text-muted-foreground",
        )}
      >
        {block.items.map((item) => (
          <li key={hashString(item)}>
            <InlineText onRefClick={onRefClick} text={item} />
          </li>
        ))}
      </ListTag>
    );
  }
  if (block.type === "table") {
    return <TableRenderer block={block} onRefClick={onRefClick} />;
  }
  if (block.lang === "mermaid") {
    return <MermaidDiagram code={block.content} />;
  }
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-[0.85em] leading-relaxed text-foreground">
      <code>{block.content}</code>
    </pre>
  );
};

const TableRenderer = ({
  block,
  onRefClick,
}: {
  block: Extract<Block, { type: "table" }>;
  onRefClick: (path: string, lineRanges: LineRange[]) => void;
}): React.JSX.Element => (
  <div className="overflow-x-auto rounded-md border border-border">
    <table className="w-full border-collapse text-[0.95em]">
      <thead className="bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <tr>
          {block.header.map((cell, cellIndex) => (
            <th
              className={cn("border-b border-border px-3 py-2", alignClass(block.align[cellIndex]))}
              key={`h-${hashString(cell)}`}
            >
              <InlineText onRefClick={onRefClick} text={cell} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {block.rows.map((row) => (
          <tr
            className="border-b border-border/60 last:border-b-0"
            key={`r-${hashString(row.join("\u0001"))}`}
          >
            {row.map((cell, cellIndex) => (
              <td
                className={cn("px-3 py-2 align-top", alignClass(block.align[cellIndex]))}
                key={`c-${hashString(cell)}`}
              >
                <InlineText onRefClick={onRefClick} text={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const alignClass = (align: TableAlign | undefined): string => {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
};

const InlineText = ({ onRefClick, text }: InlineRendererProps): React.JSX.Element => {
  const nodes = useMemo(() => parseInlineNodes(text), [text]);
  return (
    <>
      {nodes.map((node) => {
        if (node.type === "text") {
          return <FormattedSpan key={node.id} text={node.text} />;
        }
        const ranges = normalizeLineRanges(node.lineRanges);
        const fileName = node.path.split("/").pop() ?? node.path;
        return (
          <button
            className="cursor-pointer font-medium text-foreground underline-offset-4 hover:underline"
            key={node.id}
            onClick={() => onRefClick(node.path, ranges)}
            type="button"
          >
            {fileName}
          </button>
        );
      })}
    </>
  );
};

const FormattedSpan = ({ text }: { text: string }): React.JSX.Element => {
  const tokens = useMemo(() => parseInlineFormatting(text), [text]);
  return (
    <>
      {tokens.map((token) => (
        <InlineTokenView key={token.id} token={token} />
      ))}
    </>
  );
};

const InlineTokenView = ({ token }: { token: InlineToken }): React.JSX.Element => {
  if (token.type === "code") {
    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground">
        {token.text}
      </code>
    );
  }
  if (token.type === "bold") {
    return <strong className="font-semibold text-foreground">{token.text}</strong>;
  }
  if (token.type === "italic") {
    return <em>{token.text}</em>;
  }
  return <span>{token.text}</span>;
};

const blockKey = (block: Block): string => {
  if (block.type === "paragraph") return `p-${hashString(block.text)}`;
  if (block.type === "list") return `l-${hashString(block.items.join("\u0001"))}`;
  if (block.type === "table") {
    return `t-${hashString(block.header.concat(block.rows.flat()).join("\u0001"))}`;
  }
  return `c-${hashString(block.content)}`;
};

const hashString = (input: string): string => {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }
  return hash.toString(36);
};
