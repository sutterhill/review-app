export interface WalkthroughSection {
  id: string;
  markdown: string;
}

export interface WalkthroughHeading {
  id: string;
  level: number;
  text: string;
}

export interface AnchoredDiff {
  anchorId: string;
  code: string;
  label?: string;
}

export interface WalkthroughLayout {
  diffs: AnchoredDiff[];
  prose: string;
}

export type WalkthroughChunk =
  | { markdown: string; type: "prose" }
  | { code: string; label?: string; type: "diff" };

export const buildWalkthroughSections = (walkthrough: string): WalkthroughSection[] =>
  splitWalkthroughBlocks(walkthrough).map((markdown, index) => ({
    id: `walkthrough-${index}`,
    markdown,
  }));

export const extractWalkthroughHeadings = (walkthrough: string): WalkthroughHeading[] => {
  const headings: WalkthroughHeading[] = [];
  for (const line of walkthrough.split("\n")) {
    const match = line.match(/^(#{1,4})\s+(.+)$/u);
    if (match) {
      const level = match[1]?.length ?? 1;
      const text = match[2] ?? "";
      headings.push({ id: `wt-${headings.length}`, level, text });
    }
  }
  return headings;
};

export const buildWalkthroughLayout = (walkthrough: string): WalkthroughLayout => {
  const proseLines: string[] = [];
  const diffs: AnchoredDiff[] = [];
  let currentDiff: { label?: string; lines: string[] } | null = null;
  let inOtherCodeFence = false;
  let diffIndex = 0;

  for (const line of walkthrough.split("\n")) {
    const trimmed = line.trim();

    if (currentDiff !== null) {
      if (trimmed === "```") {
        const anchorId = `diff-anchor-${diffIndex++}`;
        proseLines.push(`<<DIFF_ANCHOR:${anchorId}>>`);
        diffs.push({ anchorId, code: currentDiff.lines.join("\n"), label: currentDiff.label });
        currentDiff = null;
      } else {
        currentDiff.lines.push(line);
      }
      continue;
    }

    if (!inOtherCodeFence && trimmed.startsWith("```diff")) {
      const previousLine = proseLines.at(-1);
      const labelMatch =
        previousLine?.trim().match(/^\*(.+)\*$/u) ?? previousLine?.trim().match(/^_(.+)_$/u);
      const label = labelMatch?.[1]?.trim();
      if (label) {
        proseLines.pop();
      }
      currentDiff = { label, lines: [] };
      continue;
    }

    if (trimmed.startsWith("```")) {
      inOtherCodeFence = !inOtherCodeFence;
    }

    proseLines.push(line);
  }

  if (currentDiff !== null) {
    if (currentDiff.label) {
      proseLines.push(`*${currentDiff.label}*`);
    }
    proseLines.push("```diff");
    proseLines.push(...currentDiff.lines);
  }

  return { diffs, prose: proseLines.join("\n").trim() };
};

export const splitIntoChunks = (markdown: string): WalkthroughChunk[] => {
  const layout = buildWalkthroughLayout(markdown);
  const diffByAnchorId = new Map(layout.diffs.map((diff) => [diff.anchorId, diff]));
  const chunks: WalkthroughChunk[] = [];
  const proseLines: string[] = [];

  const flushProse = (): void => {
    const text = proseLines
      .join("\n")
      .trim()
      .replace(/\n{3,}/gu, "\n\n");
    if (text.length > 0) {
      chunks.push({ markdown: text, type: "prose" });
    }
    proseLines.length = 0;
  };

  for (const line of layout.prose.split("\n")) {
    const anchor = line.trim().match(/^<<DIFF_ANCHOR:(.+)>>$/u);
    if (anchor) {
      flushProse();
      const diff = diffByAnchorId.get(anchor[1] ?? "");
      if (diff) {
        chunks.push({ code: diff.code, label: diff.label, type: "diff" });
      }
      continue;
    }

    proseLines.push(line);
  }

  flushProse();
  return chunks;
};

const splitWalkthroughBlocks = (walkthrough: string): string[] => {
  const blocks: string[] = [];
  const current: string[] = [];
  let isCodeFence = false;

  for (const line of walkthrough.replaceAll("\r\n", "\n").trim().split("\n")) {
    if (line.trim().startsWith("```")) {
      isCodeFence = !isCodeFence;
    }

    if (!isCodeFence && line.trim().length === 0) {
      flushBlock(blocks, current);
      continue;
    }

    current.push(line);
  }

  flushBlock(blocks, current);
  return blocks;
};

const flushBlock = (blocks: string[], current: string[]): void => {
  if (current.length === 0) {
    return;
  }

  blocks.push(current.join("\n"));
  current.length = 0;
};
