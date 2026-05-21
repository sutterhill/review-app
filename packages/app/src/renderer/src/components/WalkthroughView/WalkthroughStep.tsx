import { useMemo } from "react";

import { cn } from "@/lib/utils";

import type {
  LineRange,
  WalkthroughFileRef,
  WalkthroughStep as WalkthroughStepData,
} from "../../store/walkthrough/walkthrough-types";
import { parseInlineNodes, type InlineNode } from "./inline-refs";

interface WalkthroughStepProps {
  index: number;
  isActive: boolean;
  onRefClick: (path: string, lineRanges: LineRange[]) => void;
  step: WalkthroughStepData;
}

export const WalkthroughStep = ({
  index,
  isActive,
  onRefClick,
  step,
}: WalkthroughStepProps): React.JSX.Element => {
  const paragraphs = useMemo(() => splitParagraphs(step.body ?? ""), [step.body]);
  const headingId = `walkthrough-step-${index}`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "scroll-mt-6 flex flex-col gap-3 border-l-2 pl-4 transition-colors",
        isActive ? "border-primary" : "border-transparent",
      )}
      data-step-index={index}
    >
      <h3 className="text-base font-semibold leading-tight text-foreground" id={headingId}>
        {step.heading}
      </h3>
      <div className="flex flex-col gap-3 text-sm leading-7 text-foreground">
        {paragraphs.map((paragraph) => (
          <ParagraphRenderer key={paragraph.key} nodes={paragraph.nodes} onRefClick={onRefClick} />
        ))}
      </div>
      {step.relevantFiles && step.relevantFiles.length > 0 ? (
        <RelevantFileChips files={step.relevantFiles} onRefClick={onRefClick} />
      ) : null}
    </section>
  );
};

interface ParagraphData {
  key: string;
  nodes: InlineNode[];
}

const ParagraphRenderer = ({
  nodes,
  onRefClick,
}: {
  nodes: InlineNode[];
  onRefClick: (path: string, lineRanges: LineRange[]) => void;
}): React.JSX.Element => (
  <p>
    {nodes.map((node) => {
      if (node.type === "text") {
        return <TextSpan key={`text-${hashString(node.text)}`} text={node.text} />;
      }
      const label = node.symbol
        ? `${node.path}:${node.symbol}`
        : node.lineRanges.length > 0
          ? `${node.path}${formatLineRanges(node.lineRanges)}`
          : node.path;
      const refKey = `ref-${node.path}-${node.symbol ?? ""}-${node.lineRanges
        .map((range) => range.join("-"))
        .join(",")}`;
      return (
        <button
          className="mx-0.5 cursor-pointer rounded-md border bg-muted/50 px-1 py-0.5 font-mono text-[0.85em] text-primary underline-offset-2 hover:bg-muted hover:underline"
          key={refKey}
          onClick={() => onRefClick(node.path, node.lineRanges)}
          type="button"
        >
          {label}
        </button>
      );
    })}
  </p>
);

const TextSpan = ({ text }: { text: string }): React.JSX.Element => {
  const parts = useMemo(() => splitInlineCode(text), [text]);
  return (
    <>
      {parts.map((part) =>
        part.code ? (
          <code
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
            key={`code-${hashString(part.code)}`}
          >
            {part.code}
          </code>
        ) : (
          <span key={`span-${hashString(part.text)}`}>{part.text}</span>
        ),
      )}
    </>
  );
};

const RelevantFileChips = ({
  files,
  onRefClick,
}: {
  files: WalkthroughFileRef[];
  onRefClick: (path: string, lineRanges: LineRange[]) => void;
}): React.JSX.Element => (
  <ul aria-label="Relevant files for this step" className="flex flex-wrap gap-1.5">
    {files.map((file) => (
      <li key={`${file.path}-${(file.lineRanges ?? []).join(",")}`}>
        <button
          className="rounded-full border bg-card px-2 py-0.5 font-mono text-[0.7rem] text-muted-foreground hover:border-primary/40 hover:text-foreground"
          onClick={() => onRefClick(file.path, file.lineRanges ?? [])}
          type="button"
        >
          {file.path}
          {file.lineRanges?.length ? formatLineRanges(file.lineRanges) : null}
        </button>
      </li>
    ))}
  </ul>
);

const splitParagraphs = (body: string): ParagraphData[] => {
  const blocks = body
    .split(/\n{2,}/u)
    .map((block) => block.trim())
    .filter(Boolean);
  if (blocks.length === 0 && body.trim().length > 0) {
    return [{ key: hashString(body), nodes: parseInlineNodes(body.trim()) }];
  }
  return blocks.map((block) => ({ key: hashString(block), nodes: parseInlineNodes(block) }));
};

const splitInlineCode = (text: string): Array<{ code: null | string; text: string }> => {
  const parts: Array<{ code: null | string; text: string }> = [];
  const pattern = /`([^`]+)`/gu;
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) parts.push({ code: null, text: text.slice(lastIndex, matchIndex) });
    parts.push({ code: match[1] ?? "", text: "" });
    lastIndex = matchIndex + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ code: null, text: text.slice(lastIndex) });
  return parts;
};

const formatLineRanges = (ranges: LineRange[]): string =>
  ranges.length > 0
    ? `#${ranges
        .map(([start, end]) => (start === end ? `L${start}` : `L${start}-${end}`))
        .join(",")}`
    : "";

const hashString = (input: string): string => {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }
  return hash.toString(36);
};
