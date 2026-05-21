import { useMemo } from "react";

import type { PullRequestFile } from "../../store/pr/pr-types";
import type {
  LineRange,
  WalkthroughFileRef,
  WalkthroughStep as WalkthroughStepData,
} from "../../store/walkthrough/walkthrough-types";
import { FileSnippet } from "./FileSnippet";
import { parseInlineNodes, type InlineNode } from "./inline-refs";
import { normalizeLineRanges } from "./normalize-line-ranges";

interface WalkthroughStepProps {
  filesByPath: ReadonlyMap<string, PullRequestFile>;
  index: number;
  isActive: boolean;
  onRefClick: (path: string, lineRanges: LineRange[]) => void;
  step: WalkthroughStepData;
}

export const WalkthroughStep = ({
  filesByPath,
  index,
  onRefClick,
  step,
}: WalkthroughStepProps): React.JSX.Element => {
  const paragraphs = useMemo(() => splitParagraphs(step.body ?? ""), [step.body]);
  const headingId = `walkthrough-step-${index}`;

  return (
    <section
      aria-labelledby={headingId}
      className="scroll-mt-6 flex flex-col gap-4"
      data-step-index={index}
    >
      <h3 className="text-base font-semibold leading-tight text-foreground" id={headingId}>
        {step.heading}
      </h3>
      <div className="flex flex-col gap-4 text-[1.02rem] font-light leading-[1.55] text-foreground">
        {paragraphs.map((paragraph) => (
          <ParagraphRenderer key={paragraph.key} nodes={paragraph.nodes} onRefClick={onRefClick} />
        ))}
      </div>
      {step.relevantFiles && step.relevantFiles.length > 0 ? (
        <RelevantFileSnippets
          files={step.relevantFiles}
          filesByPath={filesByPath}
          onRefClick={onRefClick}
        />
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
        return <TextSpan key={node.id} text={node.text} />;
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
  </p>
);

const TextSpan = ({ text }: { text: string }): React.JSX.Element => {
  const parts = useMemo(() => splitInlineCode(text), [text]);
  return (
    <>
      {parts.map((part) =>
        part.code !== null ? (
          <code
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
            key={part.id}
          >
            {part.code}
          </code>
        ) : (
          <span key={part.id}>{part.text}</span>
        ),
      )}
    </>
  );
};

const RelevantFileSnippets = ({
  files,
  filesByPath,
  onRefClick,
}: {
  files: WalkthroughFileRef[];
  filesByPath: ReadonlyMap<string, PullRequestFile>;
  onRefClick: (path: string, lineRanges: LineRange[]) => void;
}): React.JSX.Element => {
  const items = useMemo(() => buildRelevantItems(files), [files]);
  return (
    <ul aria-label="Relevant files for this step" className="flex flex-col gap-4">
      {items.map((item) => {
        const file = filesByPath.get(item.path);
        return (
          <li key={item.id}>
            <FileSnippet
              lineRanges={item.ranges}
              onClick={() => onRefClick(item.path, item.ranges)}
              patch={file?.patch ?? ""}
              path={item.path}
            />
          </li>
        );
      })}
    </ul>
  );
};

interface RelevantItem {
  id: string;
  path: string;
  ranges: LineRange[];
}

const buildRelevantItems = (files: WalkthroughFileRef[]): RelevantItem[] => {
  const used = new Set<string>();
  const items: RelevantItem[] = [];
  for (const file of files) {
    const ranges = normalizeLineRanges(file.lineRanges);
    const base = `${file.path}#${ranges.map((range) => range.join("-")).join(",")}`;
    let id = base;
    let suffix = 1;
    while (used.has(id)) {
      suffix += 1;
      id = `${base}~${suffix}`;
    }
    used.add(id);
    items.push({ id, path: file.path, ranges });
  }
  return items;
};

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

interface InlineCodePart {
  code: null | string;
  id: string;
  text: string;
}

const splitInlineCode = (text: string): InlineCodePart[] => {
  const parts: InlineCodePart[] = [];
  const pattern = /`([^`]+)`/gu;
  let lastIndex = 0;
  let counter = 0;
  for (const match of text.matchAll(pattern)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      counter += 1;
      parts.push({ code: null, id: `t${counter}`, text: text.slice(lastIndex, matchIndex) });
    }
    counter += 1;
    parts.push({ code: match[1] ?? "", id: `c${counter}`, text: "" });
    lastIndex = matchIndex + match[0].length;
  }
  if (lastIndex < text.length) {
    counter += 1;
    parts.push({ code: null, id: `t${counter}`, text: text.slice(lastIndex) });
  }
  return parts;
};

const hashString = (input: string): string => {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }
  return hash.toString(36);
};
